use std::sync::Arc;

use axum::{extract::State, Json};
use shielder_prover_common::protocol::{Request, Response};
use tracing::instrument;

use crate::{error::ShielderProverServerError, handlers::request, AppState};

#[instrument(level = "trace")]
pub async fn tee_public_key(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Response>, ShielderProverServerError> {
    let task_pool = state.task_pool.clone();

    task_pool
        .spawn(async move { request(state, Request::TeePublicKey).await })
        .await
        .map_err(ShielderProverServerError::TaskPool)?
        .await
        .map_err(ShielderProverServerError::JoinHandleError)??
        .map_err(ShielderProverServerError::ProvingServerError)
}
