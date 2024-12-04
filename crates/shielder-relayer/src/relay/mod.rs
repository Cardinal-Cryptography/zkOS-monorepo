use alloy_provider::Provider;
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use shielder_relayer::{QuoteFeeResponse, RelayQuery, RelayResponse, SimpleServiceResponse};
use shielder_rust_sdk::{
    alloy_primitives::{Address, U256},
    contract::{providers::create_simple_provider, ShielderContract::withdrawNativeCall},
    version::{contract_version, ContractVersion},
};
use tracing::{debug, error};

pub use crate::relay::taskmaster::Taskmaster;
use crate::{
    metrics::WITHDRAW_FAILURE,
    relay::{request_trace::RequestTrace, taskmaster::TaskResult},
    AppState,
};

mod monitoring;
mod request_trace;
mod taskmaster;

const TASK_QUEUE_SIZE: usize = 1024;
const OPTIMISTIC_DRY_RUN_THRESHOLD: u32 = 32;

pub async fn relay(app_state: State<AppState>, Json(query): Json<RelayQuery>) -> impl IntoResponse {
    debug!("Relay request received: {query:?}");
    let mut request_trace = RequestTrace::new(&query);

    if let Err(response) = check_expected_version(&query, &mut request_trace) {
        return response;
    }

    let quoted_fees = match quote_relayer_fees(
        app_state.relay_gas,
        app_state.relay_fee,
        &app_state.node_rpc_url,
    )
    .await
    {
        Ok(quoted_fees) => quoted_fees,
        Err(response) => return response,
    };

    let withdraw_call = create_call(
        query,
        app_state.fee_destination,
        quoted_fees.base_fee + quoted_fees.relay_fee,
    );
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

pub async fn quote_fees(app_state: State<AppState>) -> impl IntoResponse {
    match quote_relayer_fees(
        app_state.relay_gas,
        app_state.relay_fee,
        &app_state.node_rpc_url,
    )
    .await
    {
        Ok(quoted_fees) => (
            StatusCode::OK,
            QuoteFeeResponse::from(quoted_fees.base_fee, quoted_fees.relay_fee),
        )
            .into_response(),
        Err(response) => response,
    }
}

fn bad_request(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, SimpleServiceResponse::from(msg)).into_response()
}

fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, SimpleServiceResponse::from(msg)).into_response()
}

fn create_call(q: RelayQuery, relayer_address: Address, relay_fee: U256) -> withdrawNativeCall {
    withdrawNativeCall {
        expectedContractVersion: q.expected_contract_version,
        idHiding: q.id_hiding,
        withdrawAddress: q.withdraw_address,
        relayerAddress: relayer_address,
        relayerFee: relay_fee,
        amount: q.amount,
        merkleRoot: q.merkle_root,
        oldNullifierHash: q.nullifier_hash,
        newNote: q.new_note,
        proof: q.proof,
    }
}

struct QuotedFees {
    base_fee: U256,
    relay_fee: U256,
}

async fn quote_relayer_fees(
    relay_gas: u64,
    relay_fee: U256,
    node_rpc_url: &str,
) -> Result<QuotedFees, Response> {
    let provider = match create_simple_provider(node_rpc_url).await {
        Ok(provider) => provider,
        Err(err) => {
            error!("[UNEXPECTED] Failed to create provider: {err}");
            return Err(server_error("Failed to create provider").into_response());
        }
    };

    match provider.get_gas_price().await {
        Ok(current_gas_price) => Ok(QuotedFees {
            base_fee: U256::from(relay_gas) * U256::from(current_gas_price),
            relay_fee,
        }),
        Err(err) => {
            error!("[UNEXPECTED] Fee quoter failed: {err}");
            Err(server_error("Could not quote fees").into_response())
        }
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
