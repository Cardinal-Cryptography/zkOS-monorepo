use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use shielder_relayer::{relayer_fee, RelayQuery, RelayResponse, SimpleServiceResponse};
use shielder_rust_sdk::{
    alloy_primitives::Address, contract::ShielderContract::withdrawNativeCall,
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
    let request_trace = RequestTrace::new(&query);

    let withdraw_call = create_call(query, app_state.fee_destination);
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

fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, SimpleServiceResponse::from(msg)).into_response()
}

fn create_call(q: RelayQuery, relayer_address: Address) -> withdrawNativeCall {
    withdrawNativeCall {
        idHiding: q.id_hiding,
        withdrawAddress: q.withdraw_address,
        relayerAddress: relayer_address,
        relayerFee: relayer_fee(),
        amount: q.amount,
        merkleRoot: q.merkle_root,
        oldNullifierHash: q.nullifier_hash,
        newNote: q.new_note,
        proof: q.proof,
    }
}
