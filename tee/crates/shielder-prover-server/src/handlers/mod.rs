use std::sync::Arc;
use axum::Json;
use log::debug;
use serde::{Deserialize, Serialize};
use shielder_prover_common::protocol::{ProverClient, Request, Response, VSOCK_PORT};
use shielder_prover_common::vsock::VsockError;
use shielder_prover_common::base64_serialization;
use crate::AppState;

pub mod health;
pub mod tee_public_key;
pub mod generate_proof;

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

/// When requesting proof generation, user sends this struct as a JSON
#[derive(Debug, Deserialize, Serialize)]
pub struct GenerateProofPayload {
    /// encrypted circuit inputs. The first byte after decryption signifies circuit type, see ['CircuitType`]
    #[serde(with = "base64_serialization")]
    payload: Vec<u8>,

    /// User's public key which should be used to encrypt generated proof, expressed as a hexstring
    /// (without "0x" prefix)
    user_public_key: String,
}

#[allow(dead_code)]
#[derive(PartialEq, Debug)]
#[repr(u8)]
pub enum CircuitType {
    NewAccount = 1,
    Deposit = 2,
    Withdraw = 4,
}
