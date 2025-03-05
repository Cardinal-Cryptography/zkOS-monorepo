use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator as _;
use strum_macros::EnumIter;
use time::OffsetDateTime;
use tokio::time::Duration;

const BASE_PATH: &str = "https://api.diadata.org/v1/assetQuotation";

#[derive(Debug, Copy, Clone, Eq, PartialEq, Hash, EnumIter, Serialize, Deserialize)]
pub enum Coin {
    Eth,
    Azero,
    Btc,
    Usdt,
    Usdc,
}

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

#[derive(Clone, Deserialize, Debug)]
struct Price {
    #[serde(rename = "Price")]
    price: Decimal,
    #[serde(
        rename = "Time",
        deserialize_with = "time::serde::iso8601::deserialize"
    )]
    time: OffsetDateTime,
}

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),
}

impl Prices {
    /// Create a new `Prices` instance with the given validity and refresh interval.
    ///
    /// Note that you should realistically set `validity` to at least 5 or 10 minutes - it seems
    /// the API we are using (DIA) updates about 2 or 3 minutes or so.
    pub fn new(validity: Duration, refresh_interval: Duration) -> Self {
        let inner = Default::default();
        let validity =
            time::Duration::new(validity.as_secs() as i64, validity.subsec_nanos() as i32);

        Self {
            validity,
            refresh_interval,
            inner,
        }
    }

    /// Get the price of a coin or `None` if the price is not available or outdated.
    pub fn price(&self, coin: Coin) -> Option<Decimal> {
        let inner = self.inner.lock().expect("Mutex poisoned");
        inner.get(&coin).cloned().and_then(|price| {
            if price
                .time
                .gt(&OffsetDateTime::now_utc().saturating_sub(self.validity))
            {
                Some(price.price)
            } else {
                None
            }
        })
    }

    /// Get the relative price of two coins or `None` if the price of one of them is not available or outdated.
    pub fn relative_price(&self, coin1: Coin, coin2: Coin) -> Option<Decimal> {
        let price1 = self.price(coin1)?;
        let price2 = self.price(coin2)?;
        Some(price1 / price2)
    }

    async fn update(&self) -> Result<(), Error> {
        for coin in Coin::iter() {
            let price = fetch_price(coin).await?;
            let mut inner = self.inner.lock().expect("Mutex poisoned");
            inner.insert(coin, price);
        }

        Ok(())
    }

    #[cfg(test)]
    pub fn set_price(&self, coin: Coin, price: Decimal) {
        let mut inner = self.inner.lock().expect("Mutex poisoned");
        let price = Price {
            price,
            time: OffsetDateTime::now_utc(),
        };
        inner.insert(coin, price);
    }
}

/// Start a price feed that updates the prices in the given `Prices` instance.
pub async fn start_price_feed(prices: Prices) -> Result<(), anyhow::Error> {
    loop {
        prices.update().await?;
        tokio::time::sleep(prices.refresh_interval).await;
    }
}

async fn fetch_price(coin: Coin) -> Result<Price, Error> {
    Ok(reqwest::get(format!("{}{}", BASE_PATH, price_path(coin)))
        .await?
        .json::<Price>()
        .await?)
}

fn price_path(coin: Coin) -> &'static str {
    match coin {
        Coin::Azero => "/AlephZero/0x0000000000000000000000000000000000000000",
        Coin::Eth => "/Ethereum/0x0000000000000000000000000000000000000000",
        Coin::Btc => "/Bitcoin/0x0000000000000000000000000000000000000000",
        Coin::Usdt => "/Ethereum/0xdAC17F958D2ee523a2206206994597C13D831ec7",
        Coin::Usdc => "/Ethereum/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    }
}
