use rust_decimal::Decimal;
use serde::Deserialize;
use time::OffsetDateTime;

/// This is the struct that we expect to receive at `https://api.diadata.org/v1/assetQuotation/`.
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
    use super::fetch_price;

    const ETH: &'static str =
        "https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000";
    const USDT: &'static str =
        "https://api.diadata.org/v1/assetQuotation/Ethereum/0xdAC17F958D2ee523a2206206994597C13D831ec7";

    #[tokio::test]
    async fn can_fetch_price_from_url() {
        for token in &[ETH, USDT] {
            fetch_price(token)
                .await
                .expect("Should connect to the feed and get price");
        }
    }
}
