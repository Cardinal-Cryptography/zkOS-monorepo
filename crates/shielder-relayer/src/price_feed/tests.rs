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
