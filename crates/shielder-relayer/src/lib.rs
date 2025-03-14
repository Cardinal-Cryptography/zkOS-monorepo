use std::str::FromStr;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use clap::ValueEnum;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use shielder_contract::alloy_primitives::{Address, Bytes, FixedBytes, TxHash, U256};
use strum_macros::EnumIter;

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
pub const TOKEN_CONFIG_ENV: &str = "TOKEN_CONFIG";
pub const NATIVE_TOKEN_ENV: &str = "NATIVE_TOKEN";

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
    // 8< ----------------------------------------------------- >8  TO BE REMOVED SOON
    /// The fee used as a contract input by the relayer.
    pub total_fee: U256,
    /// The estimation of a base fee for relay call.
    pub base_fee: U256,
    /// The estimation of a relay fee for relay call.
    pub relay_fee: U256,
    // 8< ----------------------------------------------------- >8
    /// The total relay cost in native token.
    pub total_cost_native: U256,
    /// The total relay cost in fee token.
    pub total_cost_fee_token: U256,

    /// Current gas price (in native token).
    pub gas_price: U256,
    /// Gas cost for relay call (in native token).
    pub gas_cost_native: U256,
    /// Gas cost for relay call (in fee token).
    pub gas_cost_fee_token: U256,

    /// The commission for the relayer in native token.
    pub commission_native: U256,
    /// The commission for the relayer in fee token.
    pub commission_fee_token: U256,

    /// Current price of the native token (base unit, like 1 ETH or 1 BTC).
    pub native_token_price: Decimal,
    /// Current price of the minimal unit of the native token (like 1 wei or 1 satoshi).
    pub native_token_unit_price: Decimal,
    /// Current price of the fee token (base unit, like 1 ETH or 1 BTC).
    pub fee_token_price: Decimal,
    /// Current price of the minimal unit of the fee token (like 1 wei or 1 satoshi).
    pub fee_token_unit_price: Decimal,
    /// Current ratio between the native token and the fee token.
    pub token_price_ratio: Decimal,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct QuoteFeeQuery {
    pub fee_token: TokenKind,
    pub pocket_money: U256,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct RelayQuery {
    pub expected_contract_version: FixedBytes<3>,
    pub amount: U256,
    pub withdraw_address: Address,
    pub merkle_root: U256,
    pub nullifier_hash: U256,
    pub new_note: U256,
    pub proof: Bytes,
    pub fee_token: TokenKind,
    pub fee_amount: U256,
    pub mac_salt: U256,
    pub mac_commitment: U256,
}

#[derive(Clone, Debug, Default, Eq, PartialEq, Deserialize, Serialize)]
pub enum TokenKind {
    #[default]
    Native,
    ERC20(Address),
}

pub fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, SimpleServiceResponse::from(msg)).into_response()
}

/// A list of all supported coins across all chains. Every relayer instance will work with some
/// subset of these coins.
#[derive(Debug, Copy, Clone, Eq, PartialEq, Hash, EnumIter, Serialize, Deserialize, ValueEnum)]
pub enum Coin {
    Eth,
    Azero,
    Btc,
    Usdt,
    Usdc,
}

impl Coin {
    pub fn decimals(&self) -> u32 {
        match self {
            Coin::Azero => 18,
            Coin::Eth => 18,
            Coin::Btc => 8,
            Coin::Usdt => 6,
            Coin::Usdc => 6,
        }
    }
}

impl FromStr for Coin {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "azero" => Ok(Coin::Azero),
            "eth" => Ok(Coin::Eth),
            "btc" => Ok(Coin::Btc),
            "usdt" => Ok(Coin::Usdt),
            "usdc" => Ok(Coin::Usdc),
            _ => Err(()),
        }
    }
}

pub const RELATIVE_PRICE_DIGITS: u32 = 20;

pub fn scale_u256(a: U256, b: Decimal) -> Result<U256, &'static str> {
    let b = b
        .round_sf(RELATIVE_PRICE_DIGITS)
        .ok_or("Arithmetic error")?;
    let mantissa: U256 = b.mantissa().try_into().map_err(|_| "Arithmetic error")?;
    let scale = U256::pow(U256::from(10), U256::from(b.scale()));
    Ok(a * mantissa / scale)
}
