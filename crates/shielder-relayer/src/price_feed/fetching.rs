use rust_decimal::Decimal;
use serde::Deserialize;
use time::OffsetDateTime;

#[derive(Clone, Debug, Deserialize)]
pub struct PriceInfoFromProvider {
    #[serde(rename = "Price")]
    pub token_price: Decimal,
    #[serde(
        rename = "Time",
        deserialize_with = "time::serde::iso8601::deserialize"
    )]
    pub time: OffsetDateTime,
}

#[derive(thiserror::Error, Debug)]
pub enum PriceFetchError {
    #[error("Reqwest error: {0}")]
    Reqwest(#[from] reqwest::Error),
}

pub async fn fetch_price(url: &str) -> Result<PriceInfoFromProvider, PriceFetchError> {
    Ok(reqwest::get(url)
        .await?
        .json::<PriceInfoFromProvider>()
        .await?)
}

#[cfg(test)]
mod tests {
    use alloy_primitives::address;
    use rust_decimal::Decimal;
    use shielder_relayer::{PriceProvider, Token, TokenKind};

    use super::fetch_price;
    fn token_with_static_price() -> Token {
        Token {
            kind: TokenKind::Native,
            price_provider: PriceProvider::Static(Decimal::ONE),
        }
    }

    fn eth_url() -> Token {
        Token {
            kind: TokenKind::ERC20 {
                address: address!("2222222222222222222222222222222222222222"),
                decimals: 18,
            },
            price_provider: PriceProvider::Url(
                "https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000".to_string(),
            ),
        }
    }

    fn usdt_url() -> Token {
        Token {
            kind: TokenKind::ERC20 {
                address: address!("1111111111111111111111111111111111111111"),
                decimals: 6,
            },
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
