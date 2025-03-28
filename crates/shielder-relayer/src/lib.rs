use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use shielder_contract::alloy_primitives::{Address, Bytes, FixedBytes, TxHash, U256};

mod environment_variables;
pub use environment_variables::*;
mod token;
pub use token::*;

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
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

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct RelayResponse {
    #[schema(value_type = String)]
    pub tx_hash: TxHash,
}

impl RelayResponse {
    pub fn from(tx_hash: TxHash) -> Json<Self> {
        Json(Self { tx_hash })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct QuoteFeeResponse {
    // 8< ----------------------------------------------------- >8  TO BE REMOVED SOON
    /// The fee used as a contract input by the relayer.
    #[schema(value_type = String)]
    pub total_fee: U256,
    /// The estimation of a base fee for relay call.
    #[schema(value_type = String)]
    pub base_fee: U256,
    /// The estimation of a relay fee for relay call.
    #[schema(value_type = String)]
    pub relay_fee: U256,
    // 8< ----------------------------------------------------- >8
    /// The total relay cost in native token.
    #[schema(value_type = String)]
    pub total_cost_native: U256,
    /// The total relay cost in fee token.
    #[schema(value_type = String)]
    pub total_cost_fee_token: U256,

    /// Current gas price (in native token).
    #[schema(value_type = String)]
    pub gas_price: U256,
    /// Gas cost for relay call (in native token).
    #[schema(value_type = String)]
    pub gas_cost_native: U256,
    /// Gas cost for relay call (in fee token).
    #[schema(value_type = String)]
    pub gas_cost_fee_token: U256,

    /// The commission for the relayer in native token.
    #[schema(value_type = String)]
    pub commission_native: U256,
    /// The commission for the relayer in fee token.
    #[schema(value_type = String)]
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

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct QuoteFeeQuery {
    pub fee_token: TokenKind,
    #[schema(value_type = String)]
    pub pocket_money: U256,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, ToSchema)]
pub struct RelayQuery {
    #[schema(value_type = Object)]
    pub expected_contract_version: FixedBytes<3>,
    #[schema(value_type = String)]
    pub amount: U256,
    #[schema(value_type = String)]
    pub withdraw_address: Address,
    #[schema(value_type = String)]
    pub merkle_root: U256,
    #[schema(value_type = String)]
    pub nullifier_hash: U256,
    #[schema(value_type = String)]
    pub new_note: U256,
    #[schema(value_type = Object)]
    pub proof: Bytes,
    pub fee_token: TokenKind,
    #[schema(value_type = String)]
    pub fee_amount: U256,
    #[schema(value_type = String)]
    pub mac_salt: U256,
    #[schema(value_type = String)]
    pub mac_commitment: U256,
    #[schema(value_type = String)]
    pub pocket_money: U256,
}

pub fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, SimpleServiceResponse::from(msg)).into_response()
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
