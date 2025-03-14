use rust_decimal::Decimal;
use serde::Deserialize;
use shielder_relayer::Coin;
use time::OffsetDateTime;

const BASE_PATH: &str = "https://api.diadata.org/v1/assetQuotation";

const fn price_path(coin: Coin) -> &'static str {
    match coin {
        Coin::Azero => "/AlephZero/0x0000000000000000000000000000000000000000",
        Coin::Eth => "/Ethereum/0x0000000000000000000000000000000000000000",
        Coin::Btc => "/Bitcoin/0x0000000000000000000000000000000000000000",
        Coin::Usdt => "/Ethereum/0xdAC17F958D2ee523a2206206994597C13D831ec7",
        Coin::Usdc => "/Ethereum/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    }
}

#[derive(Clone, Debug)]
pub struct Price {
    /// Price for a main unit of the token, like 1 ETH or 1 BTC.
    pub token_price: Decimal,
    /// Price for the minimal unit of the token, like 1 wei or 1 satoshi.
    pub unit_price: Decimal,
    /// The time when the price has been created at the provider.
    pub(super) time: OffsetDateTime,
}

#[derive(Clone, Debug, Deserialize)]
struct PriceInfoFromProvider {
    #[serde(rename = "Price")]
    token_price: Decimal,
    #[serde(
        rename = "Time",
        deserialize_with = "time::serde::iso8601::deserialize"
    )]
    time: OffsetDateTime,
}

impl From<(Coin, PriceInfoFromProvider)> for Price {
    fn from((coin, from_provider): (Coin, PriceInfoFromProvider)) -> Self {
        Self {
            token_price: from_provider.token_price,
            unit_price: from_provider.token_price
                * Decimal::from_i128_with_scale(1, coin.decimals()),
            time: from_provider.time,
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum PriceFetchError {
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),
}

pub async fn fetch_price(coin: Coin) -> Result<Price, PriceFetchError> {
    Ok(reqwest::get(format!("{BASE_PATH}{}", price_path(coin)))
        .await?
        .json::<PriceInfoFromProvider>()
        .await
        .map(|price_info| (coin, price_info).into())?)
}

#[cfg(test)]
mod tests {
    use rust_decimal::Decimal;
    use shielder_relayer::Coin;
    use strum::IntoEnumIterator;

    use super::fetch_price;

    #[tokio::test]
    async fn can_fetch_prices() {
        for coin in Coin::iter() {
            fetch_price(coin)
                .await
                .expect("Should connect to the feed and get price");
        }
    }

    #[tokio::test]
    async fn unit_price_is_correct() {
        // ------------- ETH has 18 decimals. -------------
        let price = fetch_price(Coin::Eth).await.unwrap();
        let expected_token_price = price.unit_price * Decimal::from(1_000_000_000_000_000_000u128);

        // Define a 1% tolerance
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

        // ------------- USDT has 6 decimals. -------------
        let price = fetch_price(Coin::Usdt).await.unwrap();
        let expected_token_price = price.unit_price * Decimal::from(1_000_000u128);

        // Define a 1% tolerance
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
