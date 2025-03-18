use alloy_primitives::Address;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Debug, Default, Hash, Eq, PartialEq, Deserialize, Serialize)]
pub enum TokenKind {
    #[default]
    Native,
    ERC20 {
        address: Address,
        decimals: u32,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub enum PriceProvider {
    Url(String),
    Static(Decimal),
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct Token {
    pub kind: TokenKind,
    pub price_provider: PriceProvider,
}

impl Token {
    pub fn decimals(&self) -> u32 {
        match self.kind {
            // Native EVM has 18 decimals by default
            TokenKind::Native => 18,
            // ERC20 enum has configured decimals
            TokenKind::ERC20(_, decimals) => decimals,
        }
    }
}
