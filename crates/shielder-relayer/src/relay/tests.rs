use alloy_primitives::address;
use shielder_contract::{NoProvider, ShielderUser};
use tokio::{sync::mpsc::channel, time::Duration};

use super::*;
use crate::{
    config::{DryRunning, TokenPricingConfig},
    price_feed::{Coin, Prices},
    relay::taskmaster::Taskmaster,
};

const NATIVE_TOTAL_FEE: u64 = 100;

/// Return some app state. Surely not functional, but is sufficient for tests.
/// Total fee is set to `NATIVE_TOTAL_FEE` native tokens.
fn app_state() -> AppState {
    let (recharge_send, _) = channel::<Address>(10);
    let users: Vec<ShielderUser<NoProvider>> = vec![];
    AppState {
        total_fee: U256::from(NATIVE_TOTAL_FEE),
        prices: Prices::new(Duration::from_secs(10), Duration::from_secs(1)),
        taskmaster: Taskmaster::new(users, DryRunning::Optimistic, recharge_send),
        node_rpc_url: Default::default(),
        balances: Default::default(),
        fee_destination: Default::default(),
        token_pricing: Default::default(),
        signer_addresses: Default::default(),
        relay_gas: Default::default(),
    }
}

mod native_fee {
    use super::*;
    use assert2::assert;

    #[test]
    fn too_low_fee_fails() {
        let query = RelayQuery {
            fee_amount: U256::from(80),
            fee_token: FeeToken::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Err(_) = check_fee(&app_state(), &query, &mut request_trace));
    }

    #[test]
    fn low_fee_but_within_margin_fails() {
        let query = RelayQuery {
            fee_amount: U256::from(99),
            fee_token: FeeToken::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Err(_) = check_fee(&app_state(), &query, &mut request_trace));
    }

    #[test]
    fn exact_fee_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(100),
            fee_token: FeeToken::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Ok(_) = check_fee(&app_state(), &query, &mut request_trace));
    }

    #[test]
    fn way_too_high_fee_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(1000000),
            fee_token: FeeToken::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Ok(_) = check_fee(&app_state(), &query, &mut request_trace));
    }
}

mod erc20_fee {
    use super::*;
    use assert2::assert;

    const ERC20_ADDRESS: Address = address!("1111111111111111111111111111111111111111");

    fn erc20_pricing() -> TokenPricingConfig {
        TokenPricingConfig {
            token: FeeToken::ERC20(ERC20_ADDRESS),
            pricing: Pricing::ProdMode {
                price_feed_coin: Coin::Eth,
            },
        }
    }

    fn native_pricing() -> TokenPricingConfig {
        TokenPricingConfig {
            token: FeeToken::Native,
            pricing: Pricing::ProdMode {
                price_feed_coin: Coin::Azero,
            },
        }
    }

    #[test]
    fn when_either_pricing_is_not_set_fails() {
        let mut app_state = AppState {
            token_pricing: vec![],
            ..app_state()
        };
        app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
        app_state.prices.set_price(Coin::Azero, Decimal::new(4, 0));

        let query = RelayQuery {
            fee_token: FeeToken::ERC20(ERC20_ADDRESS),
            fee_amount: U256::from(100000000),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        // When none is set.
        assert!(let Err(_) = check_fee(&app_state, &query, &mut request_trace));

        // When native is not set.
        app_state.token_pricing = vec![erc20_pricing()];
        assert!(let Err(_) = check_fee(&app_state, &query, &mut request_trace));

        // When fee token is not set.
        app_state.token_pricing = vec![native_pricing()];
        assert!(let Err(_) = check_fee(&app_state, &query, &mut request_trace));
    }
}

// #[test]
// fn erc20_fee_too_low() {
//     let mut app_state = app_state();
//     app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
//     app_state.prices.set_price(Coin::Azero, Decimal::new(4, 0));
//     app_state.token_pricing = vec![TokenPricingConfig {
//         token: coin_address,
//         pricing: Pricing::ProdMode {
//             price_feed_coin: Coin::Azero,
//         },
//     }];
//     let mut query = RelayQuery::default();
//     query.fee_amount = U256::from(160);
//     query.fee_token = FeeToken::ERC20(coin_address);
//     let mut request_trace = RequestTrace::new(&query);
//
//     let result = check_fee(&app_state, &query, &mut request_trace);
//
//     assert!(let Err(_) = result);
// }

// #[test]
// fn erc20_fee_ok() {
//     let mut app_state = app_state();
//     app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
//     app_state.prices.set_price(Coin::Azero, Decimal::new(4, 0));
//     app_state.token_pricing = vec![TokenPricingConfig {
//         token: coin_address,
//         pricing: Pricing::ProdMode {
//             price_feed_coin: Coin::Azero,
//         },
//     }];
//     let mut query = RelayQuery::default();
//     query.fee_amount = U256::from(190);
//     query.fee_token = FeeToken::ERC20(coin_address);
//     let mut request_trace = RequestTrace::new(&query);
//
//     let result = check_fee(&app_state, &query, &mut request_trace);
//
//     assert!(let Ok(_) = result);
// }

// #[test]
// fn erc20_fee_not_allowed() {
//     let mut app_state = app_state();
//     let mut query = RelayQuery::default();
//     query.fee_amount = U256::from(100);
//     query.fee_token = FeeToken::ERC20(coin_address);
//     let mut request_trace = RequestTrace::new(&query);
//
//     let result = check_fee(&app_state, &query, &mut request_trace);
//
//     assert!(let Err(_) = result);
// }

// #[test]
// fn erc20_fee_dev_mode() {
//     let mut app_state = app_state();
//     app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
//     app_state.token_pricing = vec![TokenPricingConfig {
//         token: coin_address,
//         pricing: Pricing::DevMode {
//             price: Decimal::new(4, 0),
//         },
//     }];
//     let mut query = RelayQuery::default();
//     query.fee_amount = U256::from(200);
//     query.fee_token = FeeToken::ERC20(coin_address);
//     let mut request_trace = RequestTrace::new(&query);
//
//     let result = check_fee(&app_state, &query, &mut request_trace);
//
//     assert!(let Ok(_) = result);
// }

// #[test]
// fn erc20_fee_prod_mode_price_feed_error() {
//     let mut app_state = app_state();
//     app_state.token_pricing = vec![TokenPricingConfig {
//         token: coin_address,
//         pricing: Pricing::ProdMode {
//             price_feed_coin: Coin::Azero,
//         },
//     }];
//     let mut query = RelayQuery::default();
//     query.fee_amount = U256::from(200);
//     query.fee_token = FeeToken::ERC20(coin_address);
//     let mut request_trace = RequestTrace::new(&query);
//
//     let result = check_fee(&app_state, &query, &mut request_trace);
//
//     assert!(let Err(_) = result);
// }
