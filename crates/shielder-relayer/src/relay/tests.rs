use alloy_primitives::address;
use assert2::assert;
use shielder_contract::{NoProvider, ShielderUser};
use tokio::{sync::mpsc::channel, time::Duration};

use super::*;
use crate::{config::DryRunning, price_feed::Prices, relay::taskmaster::Taskmaster};

#[test]
fn native_fee_too_low() {
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(80);
    query.fee_token = FeeToken::Native;
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Err(_) = result);
}

#[test]
fn native_fee_ok() {
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(100);
    query.fee_token = FeeToken::Native;
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Ok(_) = result);
}

#[test]
fn erc20_fee_too_low() {
    let coin_address = address!("1111111111111111111111111111111111111111");
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
    app_state.prices.set_price(Coin::Azero, Decimal::new(4, 0));
    app_state.fee_token_config = vec![FeeTokenConfig {
        address: coin_address,
        pricing: Pricing::ProdMode {
            price_feed_coin: Coin::Azero,
        },
    }];
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(160);
    query.fee_token = FeeToken::ERC20(coin_address);
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Err(_) = result);
}

#[test]
fn erc20_fee_ok() {
    let coin_address = address!("1111111111111111111111111111111111111111");
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
    app_state.prices.set_price(Coin::Azero, Decimal::new(4, 0));
    app_state.fee_token_config = vec![FeeTokenConfig {
        address: coin_address,
        pricing: Pricing::ProdMode {
            price_feed_coin: Coin::Azero,
        },
    }];
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(190);
    query.fee_token = FeeToken::ERC20(coin_address);
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Ok(_) = result);
}

#[test]
fn erc20_fee_not_allowed() {
    let coin_address = address!("1111111111111111111111111111111111111111");
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(100);
    query.fee_token = FeeToken::ERC20(coin_address);
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Err(_) = result);
}

#[test]
fn erc20_fee_dev_mode() {
    let coin_address = address!("1111111111111111111111111111111111111111");
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
    app_state.fee_token_config = vec![FeeTokenConfig {
        address: coin_address,
        pricing: Pricing::DevMode {
            price: Decimal::new(4, 0),
        },
    }];
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(200);
    query.fee_token = FeeToken::ERC20(coin_address);
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Ok(_) = result);
}

#[test]
fn erc20_fee_prod_mode_price_feed_error() {
    let coin_address = address!("1111111111111111111111111111111111111111");
    let mut app_state = app_state();
    app_state.total_fee = U256::from(100);
    app_state.fee_token_config = vec![FeeTokenConfig {
        address: coin_address,
        pricing: Pricing::ProdMode {
            price_feed_coin: Coin::Azero,
        },
    }];
    let mut query = RelayQuery::default();
    query.fee_amount = U256::from(200);
    query.fee_token = FeeToken::ERC20(coin_address);
    let mut request_trace = RequestTrace::new(&query);

    let result = check_fee(&app_state, &query, &mut request_trace);

    assert!(let Err(_) = result);
}

fn app_state() -> AppState {
    let (send, _) = channel::<Address>(10);
    let users: Vec<ShielderUser<NoProvider>> = vec![];
    AppState {
        total_fee: U256::from(100),
        prices: Prices::new(Duration::from_secs(10), Duration::from_secs(1)),
        taskmaster: Taskmaster::new(users, DryRunning::Optimistic, send),
        node_rpc_url: "http://localhost:8545".to_string(),
        balances: Default::default(),
        fee_destination: address!("1111111111111111111111111111111111111111"),
        fee_token_config: vec![],
        signer_addresses: vec![],
        relay_gas: 0,
    }
}
