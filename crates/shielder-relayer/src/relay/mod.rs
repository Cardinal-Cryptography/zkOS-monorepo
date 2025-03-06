use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rust_decimal::Decimal;
use shielder_contract::{
    alloy_primitives::{Address, U256},
    ShielderContract::withdrawNativeCall,
};
use shielder_relayer::{server_error, FeeToken, RelayQuery, RelayResponse, SimpleServiceResponse};
use shielder_setup::version::{contract_version, ContractVersion};
use tracing::{debug, error};

pub use crate::relay::taskmaster::Taskmaster;
use crate::{
    config::Pricing,
    metrics::WITHDRAW_FAILURE,
    price_feed::Prices,
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
const RELATIVE_PRICE_DIGITS: u32 = 20;
const FEE_MARGIN_PERCENT: u32 = 10;

pub async fn relay(app_state: State<AppState>, Json(query): Json<RelayQuery>) -> impl IntoResponse {
    debug!("Relay request received: {query:?}");
    let mut request_trace = RequestTrace::new(&query);

    if let Err(response) = check_expected_version(&query, &mut request_trace) {
        return response;
    }
    if let Err(response) = check_fee(&app_state, &query, &mut request_trace) {
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

fn create_call(q: RelayQuery, relayer_address: Address, relayer_fee: U256) -> withdrawNativeCall {
    withdrawNativeCall {
        expectedContractVersion: q.expected_contract_version,
        idHiding: q.id_hiding,
        withdrawalAddress: q.withdraw_address,
        relayerAddress: relayer_address,
        relayerFee: relayer_fee,
        amount: q.amount,
        merkleRoot: q.merkle_root,
        oldNullifierHash: q.nullifier_hash,
        newNote: q.new_note,
        proof: q.proof,
        macSalt: q.mac_salt,
        macCommitment: q.mac_commitment,
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
        FeeToken::Native => {
            // todo: discuss if we want to prevent users from spending too much
            if query.fee_amount < app_state.total_fee {
                request_trace.record_insufficient_fee(query.fee_amount);
                return Err(bad_request("Insufficient fee."));
            }
        }
        FeeToken::ERC20(address) => check_erc20_fee(app_state, address, query, request_trace)?,
    }
    Ok(())
}

fn check_erc20_fee(
    app_state: &AppState,
    fee_token_address: Address,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let fee_token_pricing = app_state
        .token_pricing
        .iter()
        .find(|x| x.token == FeeToken::ERC20(fee_token_address))
        .map(|p| &p.pricing);

    let native_pricing = app_state
        .token_pricing
        .iter()
        .find(|x| x.token == FeeToken::Native)
        .map(|p| &p.pricing);

    match (fee_token_pricing, native_pricing) {
        (None, _) => {
            request_trace.record_incorrect_token_fee(fee_token_address);
            Err(bad_request(&format!(
                "Fee token {fee_token_address} is not allowed."
            )))
        }
        (Some(_), None) => {
            error!("MISSING NATIVE TOKEN PRICING!");
            Err(server_error("Server is missing native token pricing."))
        }
        (Some(fee_token_pricing), Some(native_pricing)) => {
            let ratio =
                price_relative_to_native(&app_state.prices, fee_token_pricing, native_pricing)
                    .ok_or_else(|| {
                        temporary_failure("Verification failed temporarily, try again later.")
                    })?;

            let expected_fee = mul_price(query.fee_amount, ratio)?;

            if add_fee_error_margin(expected_fee) < app_state.total_fee {
                request_trace.record_insufficient_fee(query.fee_amount);
                return Err(bad_request("Insufficient fee."));
            }
            Ok(())
        }
    }
}

fn price_relative_to_native(
    prices: &Prices,
    fee_token_pricing: &Pricing,
    native_pricing: &Pricing,
) -> Option<Decimal> {
    let resolve_price = |pricing: &Pricing| match pricing {
        Pricing::Fixed { price } => Some(*price),
        Pricing::ProdMode { price_feed_coin } => prices.price(*price_feed_coin),
    };
    let fee_token_price = resolve_price(fee_token_pricing)?;
    let native_price = resolve_price(native_pricing)?;

    Some(fee_token_price / native_price)
}

fn mul_price(a: U256, b: Decimal) -> Result<U256, Response> {
    let b = b
        .round_sf(RELATIVE_PRICE_DIGITS)
        .ok_or_else(|| internal_server_error("Pricing error"))?;
    let mantissa: U256 = b
        .mantissa()
        .try_into()
        .map_err(|_| internal_server_error("Pricing error"))?;
    let scale = U256::pow(U256::from(10), U256::from(b.scale()));

    Ok(a * mantissa / scale)
}

fn add_fee_error_margin(fee: U256) -> U256 {
    fee * U256::from(100 + FEE_MARGIN_PERCENT) / U256::from(100)
}
