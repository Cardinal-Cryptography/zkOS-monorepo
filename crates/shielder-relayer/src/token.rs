use alloy_primitives::Address;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Copy, Clone, Debug, Default, Hash, Eq, PartialEq, Deserialize, Serialize)]
pub enum TokenKind {
    #[default]
    Native,
    ERC20(Address),
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub enum PriceProvider {
    Url(String),
    Static(Decimal),
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize, Serialize)]
pub struct Token {
    pub kind: TokenKind,
    pub decimals: u32,
    pub price_provider: PriceProvider,
}
