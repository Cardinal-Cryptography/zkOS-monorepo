use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use shielder_contract::alloy_primitives::{Address, Bytes, FixedBytes, TxHash, U256};
use utoipa::ToSchema;

mod environment_variables;
pub use environment_variables::*;
use shielder_account::Token;

mod token;
pub use token::*;
mod fee;
pub mod server;
pub use fee::*;

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
#[serde(transparent)]
pub struct SimpleServiceResponse {
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, ToSchema)]
pub struct RelayResponse {
    #[schema(value_type = String)]
    pub tx_hash: TxHash,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, ToSchema)]
pub struct RelayCalldata {
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
    #[schema(value_type = Object, examples("Native", json!({"ERC20": "0x1234"})))]
    pub fee_token: Token,
    #[schema(value_type = String)]
    pub fee_amount: U256,
    #[schema(value_type = String)]
    pub mac_salt: U256,
    #[schema(value_type = String)]
    pub mac_commitment: U256,
    #[schema(value_type = String)]
    pub pocket_money: U256,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, ToSchema)]
pub struct RelayQuote {
    #[schema(value_type = String)]
    pub gas_price: U256,
    pub native_token_unit_price: Decimal,
    pub fee_token_unit_price: Decimal,
}

impl From<QuoteFeeResponse> for RelayQuote {
    fn from(response: QuoteFeeResponse) -> Self {
        Self {
            gas_price: response.price_details.gas_price,
            native_token_unit_price: response.price_details.native_token_unit_price,
            fee_token_unit_price: response.price_details.fee_token_unit_price,
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, ToSchema)]
pub struct RelayQuery {
    pub calldata: RelayCalldata,
    pub quote: RelayQuote,
}
