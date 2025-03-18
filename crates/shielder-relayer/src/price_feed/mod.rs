use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

pub use fetching::Price;
use fetching::{fetch_price, PriceFetchError};
#[cfg(test)]
use rust_decimal::Decimal;
use shielder_relayer::{PriceProvider, Token, TokenKind};
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
    tokens: HashMap<TokenKind, Token>,
    inner: HashMap<TokenKind, Arc<Mutex<Option<Price>>>>,
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

        let mut token_map = HashMap::new();
        let mut inner = HashMap::new();

        for token in tokens {
            token_map.insert(token.kind, token.clone());
            let price = match &token.price_provider {
                PriceProvider::Url(_) => None,
                // TODO in next PR: make static price non-expiring
                PriceProvider::Static(price) => Some(Price::new_now(*price, token.decimals())),
            };
            inner.insert(token.kind, Arc::new(Mutex::new(price)));
        }

        Self {
            validity,
            refresh_interval,
            tokens: token_map,
            inner,
        }
    }

    /// Get the price of a token or `None` if the price is not available or outdated.
    pub fn price(&self, token: TokenKind) -> Option<Price> {
        let price = self
            .inner
            .get(&token)?
            .lock()
            .expect("Mutex poisoned")
            .clone();
        match price {
            Some(price) => price
                .time
                .gt(&OffsetDateTime::now_utc().saturating_sub(self.validity))
                .then_some(price.clone()),
            None => None,
        }
    }

    async fn update(&self) -> Result<(), PriceFetchError> {
        for token in self.tokens.values() {
            let price = fetch_price(token).await?;
            self.inner
                .get(&token.kind)
                .unwrap()
                .lock()
                .expect("Mutex poisoned")
                .replace(price);
        }

        Ok(())
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
            price_provider: PriceProvider::Static(Decimal::ONE),
        }
    }

    fn token_with_url_price() -> Token {
        Token {
            kind: TokenKind::Native,
            price_provider: PriceProvider::Url(
                "https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000".to_string(),
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
