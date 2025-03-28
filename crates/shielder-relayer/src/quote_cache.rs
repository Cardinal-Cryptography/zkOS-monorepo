use std::{collections::HashMap, sync::Arc, time::Duration};

use alloy_primitives::U256;
use rust_decimal::Decimal;
use shielder_account::Token;
use time::OffsetDateTime;
use tokio::{sync::Mutex, time::interval};

/// Quote data that was presented to a user and should be referenced to during relay request.
#[derive(Copy, Clone, Debug, Hash, PartialEq, Eq)]
pub struct CachedQuote {
    /// Requested fee token.
    pub fee_token: Token,
    /// Gas price (in native token) at the quotation moment.
    pub gas_price: U256,
    /// Price of the native token (base unit, like 1 ETH or 1 BTC) at the quotation moment.
    pub native_token_price: Decimal,
    /// Ratio between the native token and the fee token at the quotation moment.
    pub token_price_ratio: Decimal,
}

/// Service storing quotations with a certain validity.
#[derive(Clone)]
pub struct QuoteCache {
    validity: Duration,
    cache: Arc<Mutex<HashMap<CachedQuote, OffsetDateTime>>>,
}

impl QuoteCache {
    /// Creates a new quote cache with given validity.
    pub fn new(quote_validity: Duration) -> Self {
        Self {
            cache: Default::default(),
            validity: quote_validity,
        }
    }

    /// Register a new quote `quote`. Its validity starts at `at` and lasts for `self.validity`.
    pub async fn store_quote_response(&self, quote: CachedQuote, at: OffsetDateTime) {
        let expiration = at + self.validity;

        let mut cache = self.cache.lock().await;
        cache
            .entry(quote)
            .and_modify(|previous_expiration| {
                // If, for some reason, there is already a quote with longer expiration, we will keep it.
                *previous_expiration = expiration.max(*previous_expiration);
            })
            .or_insert(expiration);
    }

    /// Check whether `quote` was recently stored.
    pub async fn is_quote_valid(&self, quote: &CachedQuote) -> bool {
        let now = OffsetDateTime::now_utc();
        match self.cache.lock().await.get(quote) {
            Some(expiration) => *expiration > now,
            None => false,
        }
    }

    /// Single sweep over cache.
    async fn collect_garbage(&self) {
        let now = OffsetDateTime::now_utc();
        let mut cache = self.cache.lock().await;
        cache.retain(|_, valid_until| *valid_until > now)
    }
}

/// Spawns a background garbage collector worker, responsible for removing expired quotes.
pub async fn garbage_collector_worker(quote_cache: QuoteCache) {
    let mut interval = interval(quote_cache.validity * 10);
    loop {
        interval.tick().await;
        quote_cache.collect_garbage().await;
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use alloy_primitives::U256;
    use rust_decimal::Decimal;
    use shielder_account::Token;
    use time::OffsetDateTime;
    use tokio::time::sleep;

    use crate::quote_cache::{garbage_collector_worker, CachedQuote, QuoteCache};

    const VALIDITY: Duration = Duration::from_millis(100);

    fn quote_cache() -> QuoteCache {
        QuoteCache::new(VALIDITY)
    }

    fn quote() -> CachedQuote {
        CachedQuote {
            fee_token: Token::Native,
            gas_price: U256::from(1),
            native_token_price: Decimal::ONE,
            token_price_ratio: Decimal::ONE,
        }
    }

    #[tokio::test]
    async fn empty_cache_has_no_valid_quotes() {
        assert!(!quote_cache().is_quote_valid(&quote()).await);
    }

    #[tokio::test]
    async fn quote_is_valid_right_after_being_cached() {
        let cache = quote_cache();
        let quote = quote();

        cache
            .store_quote_response(quote, OffsetDateTime::now_utc())
            .await;

        assert!(cache.is_quote_valid(&quote).await);
    }

    #[tokio::test]
    async fn quote_is_invalid_after_validity_period() {
        let cache = quote_cache();
        let quote = quote();

        cache
            .store_quote_response(quote, OffsetDateTime::now_utc())
            .await;

        sleep(VALIDITY * 2).await;

        assert!(!cache.is_quote_valid(&quote).await);
    }

    fn ith_quote(i: usize) -> CachedQuote {
        CachedQuote {
            gas_price: U256::from(i as u64),
            ..quote()
        }
    }

    #[tokio::test]
    async fn differentiates_between_quotes() {
        let cache = quote_cache();
        let quote1 = ith_quote(1);
        let quote2 = ith_quote(2);
        assert_ne!(quote1, quote2);

        cache
            .store_quote_response(quote1, OffsetDateTime::now_utc())
            .await;

        assert!(cache.is_quote_valid(&quote1).await);
        assert!(!cache.is_quote_valid(&quote2).await);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn garbage_collection_worker_works() {
        let cache = quote_cache();
        tokio::spawn(garbage_collector_worker(cache.clone()));

        let now = OffsetDateTime::now_utc();

        cache.store_quote_response(ith_quote(1), now).await;
        cache.store_quote_response(ith_quote(2), now).await;

        // Both quotes are valid.
        assert_eq!(cache.cache.lock().await.len(), 2);

        // Garbage collection should be triggered after 10x validity.
        sleep(VALIDITY * 12).await;

        // Both quotes should have been reaped.
        assert_eq!(cache.cache.lock().await.len(), 0);
    }
}
