use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

pub use fetching::Price;
use fetching::{fetch_price, PriceFetchError};
#[cfg(test)]
use rust_decimal::Decimal;
use shielder_relayer::Coin;
use strum::IntoEnumIterator;
use time::OffsetDateTime;
use tokio::time::Duration;

mod fetching;

/// A collection of prices for various coins.
///
/// The underlying structure is behind a mutex and a process to update it
/// asynchronously can be started with `start_price_feed`.
#[derive(Clone)]
pub struct Prices {
    validity: time::Duration,
    refresh_interval: Duration,
    inner: Arc<Mutex<HashMap<Coin, Price>>>,
}

impl Prices {
    /// Create a new `Prices` instance with the given validity and refresh interval.
    ///
    /// Note that you should realistically set `validity` to at least 5 or 10 minutes - it seems
    /// the API we are using (DIA) updates about 2 or 3 minutes or so.
    pub fn new(validity: Duration, refresh_interval: Duration) -> Self {
        let validity =
            time::Duration::new(validity.as_secs() as i64, validity.subsec_nanos() as i32);
        let inner = Default::default();

        Self {
            validity,
            refresh_interval,
            inner,
        }
    }

    /// Get the price of a coin or `None` if the price is not available or outdated.
    pub fn price(&self, coin: Coin) -> Option<Price> {
        let inner = self.inner.lock().expect("Mutex poisoned");

        inner.get(&coin).cloned().and_then(|price| {
            if price
                .time
                .gt(&OffsetDateTime::now_utc().saturating_sub(self.validity))
            {
                Some(price)
            } else {
                None
            }
        })
    }

    async fn update(&self) -> Result<(), PriceFetchError> {
        for coin in Coin::iter() {
            let price = fetch_price(coin).await?;
            let mut inner = self.inner.lock().expect("Mutex poisoned");
            inner.insert(coin, price);
        }

        Ok(())
    }

    #[cfg(test)]
    pub fn set_price(&self, coin: Coin, unit_price: Decimal) {
        let price = Price {
            token_price: unit_price / Decimal::from_i128_with_scale(1, coin.decimals()),
            unit_price,
            time: OffsetDateTime::now_utc(),
        };
        self.inner
            .lock()
            .expect("Mutex poisoned")
            .insert(coin, price);
    }
}

/// Start a price feed that updates the prices in the given `Prices` instance.
pub async fn start_price_feed(prices: Prices) -> Result<(), anyhow::Error> {
    loop {
        prices.update().await?;
        tokio::time::sleep(prices.refresh_interval).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn single_update() {
        let prices = Prices::new(Duration::from_secs(1_000_000), Default::default());
        prices.update().await.unwrap();
        for coin in Coin::iter() {
            assert!(prices.price(coin).is_some());
        }
    }

    #[tokio::test]
    async fn with_short_validity_even_after_update_there_is_no_price_available() {
        let prices = Prices::new(Duration::from_millis(1), Default::default());
        prices.update().await.unwrap();
        for coin in Coin::iter() {
            assert!(prices.price(coin).is_none());
        }
    }

    #[tokio::test]
    async fn start_price_feed_works() {
        let prices = Prices::new(Duration::from_secs(1_000_000), Duration::from_secs(1));
        tokio::spawn(start_price_feed(prices.clone()));

        tokio::time::sleep(Duration::from_secs(10)).await;
        for coin in Coin::iter() {
            assert!(prices.price(coin).is_some());
        }
    }
}
