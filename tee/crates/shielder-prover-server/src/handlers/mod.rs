use std::sync::Arc;
use axum::Json;
use log::debug;
use shielder_prover_common::protocol::{ProverClient, Request, Response, VSOCK_PORT};
use shielder_prover_common::vsock::VsockError;
use crate::AppState;

pub mod health;
pub mod tee_public_key;

async fn request(state: Arc<AppState>, request: Request) -> Result<Json<Response>, VsockError> {
    debug!("Sending TEE request: {:?}", request);

    let mut tee_client = ProverClient::new(state.options.tee_cid, VSOCK_PORT)
        .await?;
    let response = tee_client
        .request(&request)
        .await?;

    debug!("Got TEE response: {:?}", response);

    Ok(Json(response))
}
