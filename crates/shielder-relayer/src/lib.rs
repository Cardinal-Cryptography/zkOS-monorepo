use axum::Json;
use serde::{Deserialize, Serialize};
use shielder_rust_sdk::{
    alloy_primitives::{Address, Bytes, FixedBytes, TxHash, U256},
    native_token::ONE_TZERO,
};

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

/// The fee that the relayer charges for relaying a transaction. Currently set to 0.1 TZERO.
pub fn relayer_fee() -> U256 {
    U256::from(ONE_TZERO / 10)
}
