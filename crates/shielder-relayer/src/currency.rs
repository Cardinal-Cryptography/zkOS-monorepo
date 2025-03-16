use std::str::FromStr;

use alloy_primitives::Address;
use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;

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

#[derive(Clone, Debug, Default, Eq, PartialEq, Deserialize, Serialize)]
pub enum TokenKind {
    #[default]
    Native,
    ERC20(Address),
}
