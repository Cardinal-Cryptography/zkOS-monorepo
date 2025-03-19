use rust_decimal::Decimal;
use time::{Duration, OffsetDateTime};
use crate::price_feed::fetching::PriceInfoFromProvider;

/// The expiration of a price.
#[derive(Clone, Debug)]
pub enum Expiration {
    /// The price is eternal and never expires.
    Eternal,
    /// The price is valid until the given time.
    ValidUntil(OffsetDateTime),
}

#[derive(Clone, Debug)]
pub struct Price {
    /// Price for a main unit of the token, like 1 ETH or 1 BTC.
    pub token_price: Decimal,
    /// Price for the minimal unit of the token, like 1 wei or 1 satoshi.
    pub unit_price: Decimal,
    /// Price expiration.
    pub(super) expiration: Expiration,
}

impl Price {
    /// Create a new eternal price.
    pub fn static_price(token_price: Decimal, decimals: u32) -> Self {
        Self {
            token_price,
            unit_price: token_price * Decimal::from_i128_with_scale(1, decimals),
            expiration: Expiration::Eternal,
        }
    }

    pub fn from_price_info(
        price_info: PriceInfoFromProvider,
        decimals: u32,
        validity: Duration,
    ) -> Self {
        Self {
            token_price: price_info.token_price,
            unit_price: price_info.token_price * Decimal::from_i128_with_scale(1, decimals),
            expiration: Expiration::ValidUntil(price_info.time + validity),
        }
    }

    /// Check if the price is still valid. If so, return a clone of the price.
    pub fn validate(&self, now: &OffsetDateTime) -> Option<Self> {
        match self.expiration {
            Expiration::Eternal => Some(self.clone()),
            Expiration::ValidUntil(expiration) => {
                if now < &expiration {
                    Some(self.clone())
                } else {
                    None
                }
            }
        }
    }
}
