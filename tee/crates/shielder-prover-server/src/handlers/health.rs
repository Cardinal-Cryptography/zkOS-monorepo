use std::sync::Arc;
use axum::extract::State;
use axum::Json;
use shielder_prover_common::protocol::{Request, Response};
use crate::AppState;
use crate::error::ShielderProverServerError;
use crate::handlers::request;

#[axum::debug_handler]
pub async fn health(State(state): State<Arc<AppState>>) -> Result<Json<Response>, ShielderProverServerError> {
    let task_pool = state.task_pool.clone();

    task_pool
        .spawn(async move { request(state, Request::Ping).await })
        .await
        .map_err(|e| ShielderProverServerError::TaskPool(e))?
        .await
        .map_err(|e| ShielderProverServerError::JoinHandleError(e))??
        .map_err(|e| ShielderProverServerError::ProvingServerError(e))
}
