use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

pub use fetching::Price;
use fetching::{fetch_price, PriceFetchError};
#[cfg(test)]
use rust_decimal::Decimal;
use shielder_relayer::{Token, TokenKind};
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
    #[allow(clippy::type_complexity)]
    inner: Arc<Mutex<HashMap<TokenKind, (Token, Option<Price>)>>>,
}

impl Prices {
    /// Create a new `Prices` instance for a set of tokens with the given validity and refresh
    /// interval.
    ///
    /// Note that you should realistically set `validity` to at least 5 or 10 minutes - it seems
    /// the API we are using (DIA) updates about 2 or 3 minutes or so.
    pub fn new(tokens: &[Token], validity: Duration, refresh_interval: Duration) -> Self {
        let validity =
            time::Duration::new(validity.as_secs() as i64, validity.subsec_nanos() as i32);
        let inner = tokens
            .iter()
            .map(|token| (token.kind, (token.clone(), None)))
            .collect::<HashMap<_, _>>();

        Self {
            validity,
            refresh_interval,
            inner: Arc::new(Mutex::new(inner)),
        }
    }

    /// Get the price of a token or `None` if the price is not available or outdated.
    pub fn price(&self, token: TokenKind) -> Option<Price> {
        let inner = self.inner.lock().expect("Mutex poisoned");

        inner.get(&token).cloned().and_then(|(_token, price)| {
            let price = price?;
            price
                .time
                .gt(&OffsetDateTime::now_utc().saturating_sub(self.validity))
                .then_some(price)
        })
    }

    async fn update(&self) -> Result<(), PriceFetchError> {
        let tokens = {
            let inner = self.inner.lock().expect("Mutex poisoned");
            inner
                .iter()
                .map(|(_, (token, _))| token.clone())
                .collect::<Vec<_>>()
        };

        for token in tokens {
            let price = fetch_price(&token).await?;
            self.inner
                .lock()
                .expect("Mutex poisoned")
                .get_mut(&token.kind)
                .unwrap()
                .1 = Some(price);
        }

        Ok(())
    }

    #[cfg(test)]
    pub fn set_price(&self, token: Token, unit_price: Decimal) {
        let price = Price {
            token_price: unit_price / Decimal::from_i128_with_scale(1, token.decimals),
            unit_price,
            time: OffsetDateTime::now_utc(),
        };
        self.inner
            .lock()
            .expect("Mutex poisoned")
            .insert(token.kind, (token, Some(price)));
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
    use shielder_relayer::PriceProvider;

    use super::*;

    fn token_with_static_price() -> Token {
        Token {
            kind: TokenKind::Native,
            decimals: 18,
            price_provider: PriceProvider::Static(Decimal::ONE),
        }
    }

    fn token_with_url_price() -> Token {
        Token {
            kind: TokenKind::Native,
            decimals: 18,
            price_provider: PriceProvider::Url(
                "/Ethereum/0x0000000000000000000000000000000000000000".to_string(),
            ),
        }
    }

    #[tokio::test]
    async fn price_available_without_update_when_using_static_provider() {
        let prices = Prices::new(
            &[token_with_static_price()],
            Duration::from_secs(1_000_000),
            Default::default(),
        );
        assert!(prices.price(TokenKind::Native).is_some());
    }

    #[tokio::test]
    async fn single_update_static_provider() {
        let prices = Prices::new(
            &[token_with_static_price()],
            Duration::from_secs(1_000_000),
            Default::default(),
        );

        prices.update().await.unwrap();

        assert!(prices.price(TokenKind::Native).is_some());
    }

    #[tokio::test]
    async fn single_update_url_provider() {
        let prices = Prices::new(
            &[token_with_url_price()],
            Duration::from_secs(1_000_000),
            Default::default(),
        );

        prices.update().await.unwrap();

        assert!(prices.price(TokenKind::Native).is_some());
    }

    #[tokio::test]
    async fn with_short_validity_even_after_update_there_is_no_price_available() {
        let prices = Prices::new(
            &[token_with_url_price()],
            Duration::from_millis(1),
            Default::default(),
        );
        prices.update().await.unwrap();

        assert!(prices.price(TokenKind::Native).is_none());
    }

    #[tokio::test]
    async fn start_price_feed_works() {
        let prices = Prices::new(
            &[token_with_url_price()],
            Duration::from_secs(1_000_000),
            Duration::from_secs(1),
        );
        tokio::spawn(start_price_feed(prices.clone()));

        tokio::time::sleep(Duration::from_secs(3)).await;
        assert!(prices.price(TokenKind::Native).is_some());
    }
}
