use std::sync::Arc;
use axum::extract::State;
use axum::Json;
use axum::response::IntoResponse;
use shielder_prover_common::protocol::Request;
use crate::AppState;
use crate::error::ShielderProverServerError;
use crate::handlers::{request, GenerateProofPayload};
pub async fn generate_proof(State(state): State<Arc<AppState>>,
                            Json(generate_proof_payload): Json<GenerateProofPayload>) -> impl IntoResponse {
    let task_pool = state.task_pool.clone();

    task_pool
        .spawn(async move { request(state, Request::GenerateProof {
            payload: generate_proof_payload.payload,
            user_public_key: generate_proof_payload.user_public_key}).await
        })
        .await
        .map_err(|e| ShielderProverServerError::TaskPool(e))?
        .await
        .map_err(|e| ShielderProverServerError::JoinHandleError(e))??
        .map_err(|e| ShielderProverServerError::ProvingServerError(e))
}
