use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use shielder_rust_sdk::alloy_primitives::{Address, Bytes, FixedBytes, TxHash, U256};

pub const LOGGING_FORMAT_ENV: &str = "LOGGING_FORMAT";
pub const RELAYER_HOST_ENV: &str = "RELAYER_HOST";
pub const RELAYER_PORT_ENV: &str = "RELAYER_PORT";
pub const RELAYER_METRICS_PORT_ENV: &str = "RELAYER_METRICS_PORT";
pub const BALANCE_MONITOR_INTERVAL_SECS_ENV: &str = "BALANCE_MONITOR_INTERVAL_SECS";
pub const FEE_DESTINATION_KEY_ENV: &str = "FEE_DESTINATION_KEY";
pub const RELAYER_SIGNING_KEYS_ENV: &str = "RELAYER_SIGNING_KEYS";
pub const NODE_RPC_URL_ENV: &str = "NODE_RPC_URL";
pub const SHIELDER_CONTRACT_ADDRESS_ENV: &str = "SHIELDER_CONTRACT_ADDRESS";
pub const NONCE_POLICY_ENV: &str = "NONCE_POLICY";
pub const DRY_RUNNING_ENV: &str = "DRY_RUNNING";
pub const RELAY_COUNT_FOR_RECHARGE_ENV: &str = "RELAY_COUNT_FOR_RECHARGE";
pub const RELAYER_FEE_ENV: &str = "RELAYER_FEE";
pub const RELAY_GAS_ENV: &str = "RELAY_GAS";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(transparent)]
pub struct SimpleServiceResponse {
    pub message: String,
}

impl SimpleServiceResponse {
    pub fn from(message: &str) -> Json<Self> {
        Json(Self {
            message: message.to_string(),
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RelayResponse {
    pub tx_hash: TxHash,
}

impl RelayResponse {
    pub fn from(tx_hash: TxHash) -> Json<Self> {
        Json(Self { tx_hash })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct QuoteFeeResponse {
    pub relayer_fee: String, // the fee used as a contract input by the relayer. decimal string
    pub base_fee: String,    // estimation of a base fee for relay call. decimal string
    pub relay_fee: String,   // estimation of a relay fee for relay call. decimal string
}

impl QuoteFeeResponse {
    pub fn from(relayer_fee: U256, base_fee: U256, relay_fee: U256) -> Json<Self> {
        Json(Self {
            relayer_fee: relayer_fee.to_string(), // convert to decimal string
            base_fee: base_fee.to_string(),       // convert to decimal string
            relay_fee: relay_fee.to_string(),     // convert to decimal string
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RelayQuery {
    pub expected_contract_version: FixedBytes<3>,
    pub id_hiding: U256,
    pub amount: U256,
    pub withdraw_address: Address,
    pub merkle_root: U256,
    pub nullifier_hash: U256,
    pub new_note: U256,
    pub proof: Bytes,
}

pub fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, SimpleServiceResponse::from(msg)).into_response()
}
