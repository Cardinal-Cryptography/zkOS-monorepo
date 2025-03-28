use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use shielder_account::{call_data::WithdrawCall, Token};
use shielder_contract::alloy_primitives::{Address, U256};
use shielder_relayer::{
    scale_u256, server_error, RelayQuery, RelayResponse, SimpleServiceResponse, TokenKind,
};
use shielder_setup::version::{contract_version, ContractVersion};
use tracing::{debug, error};

pub use crate::relay::taskmaster::Taskmaster;
use crate::{
    metrics::WITHDRAW_FAILURE,
    relay::{request_trace::RequestTrace, taskmaster::TaskResult},
    AppState,
};

#[cfg(test)]
mod fee_checking_tests;
mod monitoring;
mod request_trace;
mod taskmaster;

const TASK_QUEUE_SIZE: usize = 1024;
const OPTIMISTIC_DRY_RUN_THRESHOLD: u32 = 32;
const FEE_MARGIN_PERCENT: u32 = 10;

/// The relay endpoint is used to relay a withdrawal request to the shielder contract.
#[utoipa::path(
    post,
    path = "/relay",
    request_body(content = RelayQuery, description = "The relay request"),
    responses(
        (status = 200, description = "Quotation successful", body = RelayResponse),
        (status = BAD_REQUEST, description = "Failed to relay withdrawal. Ensure your query, including proof, is correct.", body = SimpleServiceResponse),
        (status = SERVICE_UNAVAILABLE, description = "Failed to obtain current chain and price info. Try again later.", body = SimpleServiceResponse),
        (status = INTERNAL_SERVER_ERROR, description = "Server encountered unexpected error. Try again later.", body = SimpleServiceResponse),
    )
)]
pub async fn relay(app_state: State<AppState>, Json(query): Json<RelayQuery>) -> impl IntoResponse {
    debug!("Relay request received: {query:?}");
    let mut request_trace = RequestTrace::new(&query);

    if let Err(response) = check_expected_version(&query, &mut request_trace) {
        return response;
    }
    if let Err(response) = check_fee(&app_state, &query, &mut request_trace) {
        return response;
    }
    if let Err(response) = check_pocket_money(&app_state, &query, &mut request_trace) {
        return response;
    }

    let withdraw_call = create_call(query, app_state.fee_destination, app_state.total_fee);
    let Ok(rx) = app_state
        .taskmaster
        .register_new_task(withdraw_call, request_trace)
        .await
    else {
        error!("Failed to register new task");
        return server_error("Failed to register new task");
    };

    match rx.await {
        Ok((mut request_trace, task_result)) => match task_result {
            TaskResult::Ok(tx_hash) => {
                request_trace.record_success(tx_hash);
                (StatusCode::OK, RelayResponse::from(tx_hash)).into_response()
            }
            TaskResult::DryRunFailed(err) => {
                request_trace.record_dry_run_failure(err);
                bad_request("Dry run failed")
            }
            TaskResult::RelayFailed(err) => {
                request_trace.record_failure(err);
                bad_request("Relay failed")
            }
        },
        Err(err) => {
            error!("[UNEXPECTED] Relay task master failed: {err}");
            metrics::counter!(WITHDRAW_FAILURE).increment(1);
            server_error("Relay task failed")
        }
    }
}

fn bad_request(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, SimpleServiceResponse::from(msg)).into_response()
}

fn temporary_failure(msg: &str) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        SimpleServiceResponse::from(msg),
    )
        .into_response()
}

fn internal_server_error(msg: &str) -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        SimpleServiceResponse::from(msg),
    )
        .into_response()
}

fn create_call(q: RelayQuery, relayer_address: Address, relayer_fee: U256) -> WithdrawCall {
    WithdrawCall {
        expected_contract_version: q.expected_contract_version,
        withdrawal_address: q.withdraw_address,
        relayer_address,
        relayer_fee,
        amount: q.amount,
        merkle_root: q.merkle_root,
        old_nullifier_hash: q.nullifier_hash,
        new_note: q.new_note,
        proof: q.proof,
        mac_salt: q.mac_salt,
        mac_commitment: q.mac_commitment,
        token: q.fee_token,
        pocket_money: q.pocket_money,
    }
}

fn check_expected_version(
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let expected_by_client = ContractVersion::from_bytes(query.expected_contract_version);
    let expected_by_relayer = contract_version();

    if expected_by_client != expected_by_relayer {
        request_trace.record_version_mismatch(expected_by_relayer, expected_by_client);
        return Err(bad_request(&format!(
            "Version mismatch: relayer expects {}, client expects {}",
            expected_by_relayer.to_bytes(),
            expected_by_client.to_bytes()
        )));
    }
    Ok(())
}

fn check_fee(
    app_state: &AppState,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    match query.fee_token {
        Token::Native => {
            // todo: discuss if we want to prevent users from spending too much
            if query.fee_amount < app_state.total_fee {
                request_trace.record_insufficient_fee(query.fee_amount);
                return Err(bad_request("Insufficient fee."));
            }
        }
        token @ Token::ERC20 { .. } => check_erc20_fee(app_state, token, query, request_trace)?,
    }
    Ok(())
}

fn check_erc20_fee(
    app_state: &AppState,
    fee_token: Token,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let fee_token = ensure_permissible_token(app_state, fee_token)?;

    let get_price = |token| {
        app_state
            .prices
            .price(token)
            .ok_or_else(|| temporary_failure(&format!("Couldn't fetch price for {token:?}.")))
    };

    let fee_token_price = get_price(fee_token)?.unit_price;
    let native_price = get_price(TokenKind::Native)?.unit_price;
    let ratio = fee_token_price / native_price;

    let expected_fee = scale_u256(query.fee_amount, ratio).map_err(internal_server_error)?;

    if add_fee_error_margin(expected_fee) < app_state.total_fee {
        request_trace.record_insufficient_fee(query.fee_amount);
        return Err(bad_request("Insufficient fee."));
    }
    Ok(())
}

fn ensure_permissible_token(app_state: &AppState, token: Token) -> Result<TokenKind, Response> {
    app_state
        .token_config
        .iter()
        .find(|t| Token::from(t.kind) == token)
        .map(|t| t.kind)
        .ok_or_else(|| {
            error!("Requested token fee is not supported: {token:?}");
            bad_request("Requested token fee is not supported.")
        })
}

fn add_fee_error_margin(fee: U256) -> U256 {
    fee * U256::from(100 + FEE_MARGIN_PERCENT) / U256::from(100)
}

fn check_pocket_money(
    app_state: &AppState,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    if query.fee_token == Token::Native && query.pocket_money != U256::ZERO {
        request_trace.record_pocket_money_native_withdrawal();
        return Err(bad_request(
            "Pocket money is not supported for native token withdrawals.",
        ));
    }
    if app_state.max_pocket_money < query.pocket_money {
        request_trace.record_pocket_money_too_high(app_state.max_pocket_money, query.pocket_money);
        return Err(bad_request("Pocket money too high."));
    }
    Ok(())
}
