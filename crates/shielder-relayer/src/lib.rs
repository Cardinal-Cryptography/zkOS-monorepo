use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use shielder_contract::alloy_primitives::{Address, Bytes, FixedBytes, TxHash, U256};

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
pub const TOTAL_FEE_ENV: &str = "TOTAL_FEE";
pub const RELAY_GAS_ENV: &str = "RELAY_GAS";
pub const PRICE_FEED_VALIDITY_ENV: &str = "PRICE_FEED_VALIDITY";
pub const PRICE_FEED_REFRESH_INTERVAL_ENV: &str = "PRICE_FEED_REFRESH_INTERVAL";
pub const TOKEN_PRICING_ENV: &str = "TOKEN_PRICING";

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
    /// The fee used as a contract input by the relayer. Decimal string.
    pub total_fee: String,
    /// The estimation of a base fee for relay call. Decimal string.
    pub base_fee: String,
    /// The estimation of a relay fee for relay call. Decimal string.
    pub relay_fee: String,
}

impl QuoteFeeResponse {
    pub fn from(total_fee: U256, base_fee: U256, relay_fee: U256) -> Json<Self> {
        Json(Self {
            total_fee: total_fee.to_string(), // convert to decimal string
            base_fee: base_fee.to_string(),   // convert to decimal string
            relay_fee: relay_fee.to_string(), // convert to decimal string
        })
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct RelayQuery {
    pub expected_contract_version: FixedBytes<3>,
    pub id_hiding: U256,
    pub amount: U256,
    pub withdraw_address: Address,
    pub merkle_root: U256,
    pub nullifier_hash: U256,
    pub new_note: U256,
    pub proof: Bytes,
    pub fee_token: FeeToken,
    pub fee_amount: U256,
    pub mac_salt: U256,
    pub mac_commitment: U256,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Deserialize, Serialize)]
pub enum FeeToken {
    #[default]
    Native,
    ERC20(Address),
}

pub fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, SimpleServiceResponse::from(msg)).into_response()
}
