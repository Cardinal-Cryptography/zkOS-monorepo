use alloy_primitives::U256;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use shielder_account::Token;
use utoipa::ToSchema;

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct QuoteFeeQuery {
    #[schema(value_type = Object, examples("Native", json!({"ERC20": "0x1234"})))]
    pub fee_token: Token,
    #[schema(value_type = String)]
    pub pocket_money: U256,
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct FeeDetails {
    /// The total relay cost in native token.
    #[schema(value_type = String)]
    pub total_cost_native: U256,
    /// The total relay cost in fee token.
    #[schema(value_type = String)]
    pub total_cost_fee_token: U256,

    /// The actual on-chain cost of the relay in native token, including gas and pocket money,
    /// but excluding the commission.
    #[schema(value_type = String)]
    pub relayer_cost_native: U256,
    /// The actual on-chain cost of the relay in fee token, including gas and pocket money,
    /// but excluding the commission.
    #[schema(value_type = String)]
    pub relayer_cost_fee_token: U256,

    /// The cost of pocket money in native.
    #[schema(value_type = String)]
    pub pocket_money_native: U256,
    /// The cost of pocket money in fee token.
    #[schema(value_type = String)]
    pub pocket_money_fee_token: U256,

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
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct PriceDetails {
    /// Current gas price (in native token).
    #[schema(value_type = String)]
    pub gas_price: U256,
    /// Current price of the native token (base unit, like 1 ETH or 1 BTC).
    pub native_token_price: Decimal,
    /// Current price of the minimal unit of the native token (like 1 wei or 1 satoshi).
    pub native_token_unit_price: Decimal,
    /// Current price of the fee token (base unit, like 1 ETH or 1 BTC).
    pub fee_token_price: Decimal,
    /// Current price of the minimal unit of the fee token (like 1 wei or 1 satoshi).
    pub fee_token_unit_price: Decimal,
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct QuoteFeeResponse {
    pub fee_details: FeeDetails,
    pub price_details: PriceDetails,
}

pub fn compute_fee(
    gas_price: U256,
    required_gas: u64,
    pocket_money: U256,
    commission: u32,
    native_token_unit_price: Decimal,
    fee_token_unit_price: Decimal,
) -> Result<FeeDetails, &'static str> {
    // Gas cost in native token.
    let gas_cost_native = U256::from(required_gas) * gas_price;
    // Actual cost of performing the relay.
    let relayer_cost_native = gas_cost_native + pocket_money;
    // Relay commission.
    let commission_native = relayer_cost_native * U256::from(commission) / U256::from(100);
    // Total cost for the user.
    let total_cost_native = relayer_cost_native + commission_native;

    let native_to_fee_ratio = native_token_unit_price / fee_token_unit_price;

    Ok(FeeDetails {
        total_cost_native,
        total_cost_fee_token: scale_u256(total_cost_native, native_to_fee_ratio)?,
        relayer_cost_native,
        relayer_cost_fee_token: scale_u256(relayer_cost_native, native_to_fee_ratio)?,
        pocket_money_native: pocket_money,
        pocket_money_fee_token: scale_u256(pocket_money, native_to_fee_ratio)?,
        gas_cost_native,
        gas_cost_fee_token: scale_u256(gas_cost_native, native_to_fee_ratio)?,
        commission_native,
        commission_fee_token: scale_u256(commission_native, native_to_fee_ratio)?,
    })
}

const RELATIVE_PRICE_DIGITS: u32 = 20;

pub fn scale_u256(a: U256, b: Decimal) -> Result<U256, &'static str> {
    let b = b
        .round_sf(RELATIVE_PRICE_DIGITS)
        .ok_or("Arithmetic error")?;
    let mantissa: U256 = b.mantissa().try_into().map_err(|_| "Arithmetic error")?;
    let scale = U256::pow(U256::from(10), U256::from(b.scale()));
    Ok(a * mantissa / scale)
}
