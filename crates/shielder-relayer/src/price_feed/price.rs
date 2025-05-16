use rust_decimal::Decimal;
use time::{Duration, OffsetDateTime};

use crate::price_feed::fetching::PriceInfoFromProvider;

/// The expiration of a price.
#[derive(Clone, Debug)]
pub enum Expiration {
    /// The price is eternal and never expires.
    Eternal,
    /// The price is valid until the given time.
    Timed {
        /// The expiration time.
        expiration: OffsetDateTime,
        /// The time when the price was fetched.
        fetched: OffsetDateTime,
    },
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
            expiration: Expiration::Timed {
                expiration: price_info.time + validity,
                fetched: price_info.time,
            },
        }
    }

    /// Check if the price is still valid. If so, return a clone of the price.
    pub fn validate(&self, now: &OffsetDateTime) -> Option<Self> {
        match self.expiration {
            Expiration::Eternal => Some(self.clone()),
            Expiration::Timed { expiration, .. } => {
                if now < &expiration {
                    Some(self.clone())
                } else {
                    None
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use rust_decimal::Decimal;
    use time::{Duration, OffsetDateTime};

    use crate::price_feed::{price::Expiration, Price};

    #[test]
    fn static_price_is_always_valid() {
        let price = Price::static_price(Decimal::ONE, 18);
        let now = OffsetDateTime::now_utc();

        assert!(price.validate(&now).is_some());
        assert!(price.validate(&(now + Duration::weeks(10))).is_some());
    }

    #[test]
    fn expiring_price_is_correctly_validated() {
        let now = OffsetDateTime::now_utc();
        let validity = Duration::minutes(10);

        let price = Price {
            token_price: Default::default(),
            unit_price: Default::default(),
            expiration: Expiration::Timed {
                expiration: now + validity,
                fetched: now,
            },
        };

        assert!(price.validate(&now).is_some());
        assert!(price.validate(&(now + (validity / 2))).is_some());
        assert!(price.validate(&(now + validity)).is_none());
        assert!(price.validate(&(now + (validity * 2))).is_none());
    }

    #[test]
    fn unit_price_is_correct() {
        let price = Price::static_price(Decimal::from(1000), 16);
        let expected_token_price = price.unit_price * Decimal::from(10_000_000_000_000_000u128);

        // Define a 1% tolerance for rounding errors.
        let margin = expected_token_price * Decimal::from_i128_with_scale(1, 2);
        let lower_bound = expected_token_price - margin;
        let upper_bound = expected_token_price + margin;

        // Assert that the actual price is within the allowed range
        assert!(
            price.token_price >= lower_bound && price.token_price <= upper_bound,
            "Price out of acceptable range: expected ~{}, got {}",
            expected_token_price,
            price.token_price
        );
    }
}
