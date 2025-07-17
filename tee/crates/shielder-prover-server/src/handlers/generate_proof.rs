use std::sync::Arc;

use axum::{extract::State, response::IntoResponse, Json};
use shielder_prover_common::protocol::Request;
use tracing::instrument;

use crate::{
    error::ShielderProverServerError,
    handlers::{request, GenerateProofPayload},
    AppState,
};

#[instrument(level = "trace")]
pub async fn generate_proof(
    State(state): State<Arc<AppState>>,
    Json(generate_proof_payload): Json<GenerateProofPayload>,
) -> impl IntoResponse {
    let task_pool = state.task_pool.clone();

    task_pool
        .spawn(async move {
            request(
                state,
                Request::GenerateProof {
                    payload: generate_proof_payload.payload,
                },
            )
            .await
        })
        .await
        .map_err(ShielderProverServerError::TaskPool)?
        .await
        .map_err(ShielderProverServerError::JoinHandleError)??
        .map_err(ShielderProverServerError::ProvingServerError)
}
