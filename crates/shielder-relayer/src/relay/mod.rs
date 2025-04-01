use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Json,
};
use shielder_account::{call_data::WithdrawCall, Token};
use shielder_contract::alloy_primitives::{Address, U256};
use shielder_relayer::{
    compute_fee,
    server::{bad_request, server_error, success_response},
    RelayCalldata, RelayQuery, RelayResponse, SimpleServiceResponse,
};
use shielder_setup::version::{contract_version, ContractVersion};
use tracing::{debug, error};

pub use crate::relay::taskmaster::Taskmaster;
use crate::{
    metrics::WITHDRAW_FAILURE,
    quote_cache::CachedQuote,
    relay::{request_trace::RequestTrace, taskmaster::TaskResult},
    AppState,
};

mod monitoring;
mod request_trace;
mod taskmaster;

const TASK_QUEUE_SIZE: usize = 1024;
const OPTIMISTIC_DRY_RUN_THRESHOLD: u32 = 32;

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
pub async fn relay(
    State(app_state): State<AppState>,
    Json(query): Json<RelayQuery>,
) -> impl IntoResponse {
    debug!("Relay request received: {query:?}");
    match _relay(app_state, query).await {
        Ok(response) => success_response(response),
        Err(err) => {
            error!("Relay request failed: {err:?}");
            err
        }
    }
}

async fn _relay(app_state: AppState, query: RelayQuery) -> Result<RelayResponse, Response> {
    let mut request_trace = RequestTrace::new(&query);

    check_expected_version(&query.calldata, &mut request_trace)?;
    check_pocket_money(&app_state, &query, &mut request_trace)?;
    check_quote_validity(&app_state, &query, &mut request_trace).await?;

    let fee_details = compute_fee(
        query.quote.gas_price,
        app_state.relay_gas,
        query.calldata.pocket_money,
        app_state.service_fee_percent,
        query.quote.native_token_unit_price,
        query.quote.fee_token_unit_price,
    )
    .map_err(server_error)?;

    let withdraw_call = create_call(
        query.calldata,
        app_state.fee_destination,
        fee_details.total_cost_fee_token,
    );
    let rx = app_state
        .taskmaster
        .register_new_task(
            withdraw_call,
            fee_details.relayer_cost_native,
            request_trace,
        )
        .await
        .map_err(|err| server_error(&format!("Failed to register new task: {err:?}")))?;

    match rx.await {
        Ok((mut request_trace, task_result)) => match task_result {
            TaskResult::Ok(tx_hash) => {
                request_trace.record_success(tx_hash);
                Ok(RelayResponse { tx_hash })
            }
            TaskResult::DryRunFailed(err) => {
                request_trace.record_dry_run_failure(err);
                Err(bad_request("Dry run failed"))
            }
            TaskResult::RelayFailed(err) => {
                request_trace.record_failure(err);
                Err(bad_request("Relay failed"))
            }
        },
        Err(err) => {
            error!("[UNEXPECTED] Relay task master failed: {err}");
            metrics::counter!(WITHDRAW_FAILURE).increment(1);
            Err(server_error("Relay task failed"))
        }
    }
}

fn create_call(c: RelayCalldata, relayer_address: Address, relayer_fee: U256) -> WithdrawCall {
    WithdrawCall {
        expected_contract_version: c.expected_contract_version,
        withdrawal_address: c.withdraw_address,
        relayer_address,
        relayer_fee,
        amount: c.amount,
        merkle_root: c.merkle_root,
        old_nullifier_hash: c.nullifier_hash,
        new_note: c.new_note,
        proof: c.proof,
        mac_salt: c.mac_salt,
        mac_commitment: c.mac_commitment,
        token: c.fee_token,
        pocket_money: c.pocket_money,
    }
}

fn check_expected_version(
    calldata: &RelayCalldata,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let expected_by_client = ContractVersion::from_bytes(calldata.expected_contract_version);
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

async fn check_quote_validity(
    app_state: &AppState,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let cached_quote = CachedQuote {
        fee_token: query.calldata.fee_token,
        gas_price: query.quote.gas_price,
        native_token_unit_price: query.quote.native_token_unit_price,
        fee_token_unit_price: query.quote.fee_token_unit_price,
    };
    match app_state.quote_cache.is_quote_valid(&cached_quote).await {
        true => Ok(()),
        false => {
            request_trace.record_quote_invalidity();
            Err(bad_request("Invalid quote (probably expired)"))
        }
    }
}

fn check_pocket_money(
    app_state: &AppState,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let pocket_money = query.calldata.pocket_money;
    if query.calldata.fee_token == Token::Native && pocket_money != U256::ZERO {
        request_trace.record_pocket_money_native_withdrawal();
        return Err(bad_request(
            "Pocket money is not supported for native token withdrawals.",
        ));
    }
    if app_state.max_pocket_money < pocket_money {
        request_trace.record_pocket_money_too_high(app_state.max_pocket_money, pocket_money);
        return Err(bad_request("Pocket money too high."));
    }
    Ok(())
}
