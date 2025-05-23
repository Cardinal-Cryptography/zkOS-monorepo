use std::fmt::Display;

use alloy_primitives::Address;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use shielder_account::Token;
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

impl From<TokenKind> for Token {
    fn from(token_kind: TokenKind) -> Self {
        match token_kind {
            TokenKind::Native => Token::Native,
            TokenKind::ERC20 { address, .. } => Token::ERC20(address),
        }
    }
}

impl Display for TokenKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let str = match self {
            TokenKind::Native => "native".to_string(),
            TokenKind::ERC20 { address, .. } => format!("erc20:{address}"),
        };
        write!(f, "{str}")
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub enum PriceProvider {
    Url(String),
    Static(Decimal),
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct TokenInfo {
    pub kind: TokenKind,
    pub price_provider: PriceProvider,
}

impl TokenInfo {
    pub fn decimals(&self) -> u32 {
        match self.kind {
            // Native EVM has 18 decimals by default
            TokenKind::Native => 18,
            // ERC20 enum has configured decimals
            TokenKind::ERC20 { decimals, .. } => decimals,
        }
    }
}
