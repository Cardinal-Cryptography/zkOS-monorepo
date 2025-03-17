use rust_decimal::Decimal;
use serde::Deserialize;
use shielder_relayer::{PriceProvider, Token};
use time::OffsetDateTime;

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

impl From<(PriceInfoFromProvider, u32)> for Price {
    fn from((from_provider, decimals): (PriceInfoFromProvider, u32)) -> Self {
        Self {
            token_price: from_provider.token_price,
            unit_price: from_provider.token_price * Decimal::from_i128_with_scale(1, decimals),
            time: from_provider.time,
        }
    }
}

#[derive(thiserror::Error, Debug)]
pub enum PriceFetchError {
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),
}

pub async fn fetch_price(token: &Token) -> Result<Price, PriceFetchError> {
    let price_info = match &token.price_provider {
        PriceProvider::Url(url) => {
            reqwest::get(url)
                .await?
                .json::<PriceInfoFromProvider>()
                .await?
        }
        PriceProvider::Static(token_price) => PriceInfoFromProvider {
            token_price: *token_price,
            time: OffsetDateTime::now_utc(),
        },
    };

    Ok(Price::from((price_info, token.decimals)))
}

#[cfg(test)]
mod tests {
    use alloy_primitives::address;
    use rust_decimal::Decimal;
    use shielder_relayer::{PriceProvider, Token, TokenKind};
    use strum::IntoEnumIterator;

    use super::fetch_price;
    fn token_with_static_price() -> Token {
        Token {
            kind: TokenKind::Native,
            decimals: 18,
            price_provider: PriceProvider::Static(Decimal::ONE),
        }
    }

    fn eth_url() -> Token {
        Token {
            kind: TokenKind::ERC20(address!("2222222222222222222222222222222222222222")),
            decimals: 18,
            price_provider: PriceProvider::Url(
                "https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000".to_string(),
            ),
        }
    }

    fn usdt_url() -> Token {
        Token {
            kind: TokenKind::ERC20(address!("1111111111111111111111111111111111111111")),
            decimals: 6,
            price_provider: PriceProvider::Url(
                "https://api.diadata.org/v1/assetQuotation/Ethereum/0xdAC17F958D2ee523a2206206994597C13D831ec7".to_string(),
            ),
        }
    }

    #[tokio::test]
    async fn can_fetch_static_price() {
        fetch_price(&token_with_static_price())
            .await
            .expect("Should just read the price");
    }

    #[tokio::test]
    async fn can_fetch_price_from_url() {
        fetch_price(&eth_url())
            .await
            .expect("Should connect to the feed and get price");
    }

    #[tokio::test]
    async fn unit_price_is_correct() {
        // ------------- ETH has 18 decimals. -------------
        let price = fetch_price(&eth_url()).await.unwrap();
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
        let price = fetch_price(&usdt_url()).await.unwrap();
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
