use alloy_primitives::Address;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Copy, Clone, Debug, Default, Hash, Eq, PartialEq, Deserialize, Serialize, ToSchema)]
pub enum TokenKind {
    #[default]
    Native,
    ERC20 {
        #[schema(value_type = String)]
        address: Address,
        decimals: u32,
    },
}

impl From<TokenKind> for shielder_account::Token {
    fn from(token_kind: TokenKind) -> Self {
        match token_kind {
            TokenKind::Native => shielder_account::Token::Native,
            TokenKind::ERC20 { address, .. } => shielder_account::Token::ERC20(address),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, ToSchema)]
pub enum PriceProvider {
    Url(String),
    Static(Decimal),
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct Token {
    pub kind: TokenKind,
    #[schema(ignore)]
    pub price_provider: PriceProvider,
}

impl Token {
    pub fn decimals(&self) -> u32 {
        match self.kind {
            // Native EVM has 18 decimals by default
            TokenKind::Native => 18,
            // ERC20 enum has configured decimals
            TokenKind::ERC20 { decimals, .. } => decimals,
        }
    }
}
