use alloy_primitives::address;
use shielder_contract::{NoProvider, ShielderUser};
use shielder_relayer::Coin;
use tokio::{sync::mpsc::channel, time::Duration};

use super::*;
use crate::{
    config::{DryRunning, TokenPricingConfig},
    price_feed::Prices,
    relay::taskmaster::Taskmaster,
};

const NATIVE_TOTAL_FEE: u64 = 100;

/// Return some app state. Surely not functional, but is sufficient for tests.
/// Total fee is set to `NATIVE_TOTAL_FEE` native tokens. Native token is set to `Coin::Azero`.
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
        native_token: Coin::Azero,
    }
}

mod native_fee {
    use assert2::assert;

    use super::*;

    #[test]
    fn too_low_fee_fails() {
        let query = RelayQuery {
            fee_amount: U256::from(80),
            fee_token: TokenKind::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Err(_) = check_fee(&app_state(), &query, &mut request_trace));
    }

    #[test]
    fn low_fee_but_within_margin_fails() {
        let query = RelayQuery {
            fee_amount: U256::from(99),
            fee_token: TokenKind::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Err(_) = check_fee(&app_state(), &query, &mut request_trace));
    }

    #[test]
    fn exact_fee_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(100),
            fee_token: TokenKind::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Ok(_) = check_fee(&app_state(), &query, &mut request_trace));
    }

    #[test]
    fn way_too_high_fee_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(1000000),
            fee_token: TokenKind::Native,
            ..Default::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        assert!(let Ok(_) = check_fee(&app_state(), &query, &mut request_trace));
    }
}

mod erc20_fee {
    use assert2::assert;
    use shielder_relayer::Coin;

    use super::*;

    const ERC20_ADDRESS: Address = address!("1111111111111111111111111111111111111111");

    fn erc20_pricing() -> TokenPricingConfig {
        TokenPricingConfig {
            token: TokenKind::ERC20(ERC20_ADDRESS),
            pricing: Pricing::Feed {
                price_feed_coin: Coin::Eth,
            },
        }
    }

    fn native_pricing() -> TokenPricingConfig {
        TokenPricingConfig {
            token: TokenKind::Native,
            pricing: Pricing::Feed {
                price_feed_coin: Coin::Azero,
            },
        }
    }

    #[test]
    fn either_pricing_is_not_set_fails() {
        let mut app_state = AppState {
            token_pricing: vec![],
            ..app_state()
        };
        app_state.prices.set_price(Coin::Eth, Decimal::new(2, 0));
        app_state.prices.set_price(Coin::Azero, Decimal::new(4, 0));

        let query = RelayQuery {
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
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

    /// Return default `AppState` with pricing set:
    ///   - prod mode for both ETH and AZERO
    ///   - ETH price is $1.5
    ///   - AZERO price is $3
    fn app_state_with_pricing() -> AppState {
        let app_state = AppState {
            token_pricing: vec![native_pricing(), erc20_pricing()],
            ..app_state()
        };
        app_state.prices.set_price(Coin::Eth, Decimal::new(15, 1));
        app_state.prices.set_price(Coin::Azero, Decimal::new(3, 0));
        app_state
    }

    #[test]
    fn exact_fee_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(200), // total fee is AZERO 100, which is worth $300
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state_with_pricing(), &query, &mut request_trace);
        assert!(let Ok(_) = result);
    }

    #[test]
    fn too_low_fee_fails() {
        let query = RelayQuery {
            fee_amount: U256::from(20), // total fee is AZERO 100, which is worth $300
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state_with_pricing(), &query, &mut request_trace);
        assert!(let Err(_) = result);
    }

    #[test]
    fn low_fee_but_within_margin_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(199), // total fee is AZERO 100, which is worth $300
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state_with_pricing(), &query, &mut request_trace);
        assert!(let Ok(_) = result);
    }

    #[test]
    fn way_too_high_fee_passes() {
        let query = RelayQuery {
            fee_amount: U256::from(200000),
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state_with_pricing(), &query, &mut request_trace);
        assert!(let Ok(_) = result);
    }

    #[test]
    fn unknown_fee_token_fails() {
        let query = RelayQuery {
            fee_amount: U256::from(200_000_000),
            fee_token: TokenKind::ERC20(address!("2222222222222222222222222222222222222222")),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state_with_pricing(), &query, &mut request_trace);
        assert!(let Err(_) = result);
    }

    #[test]
    fn price_feed_failure_leads_to_failure() {
        let app_state = app_state();
        app_state.prices.set_price(Coin::Eth, Decimal::new(15, 1));
        // there is no way of checking AZERO price (we don't configure background
        // price fetching nor we set the price manually)

        let query = RelayQuery {
            fee_amount: U256::from(200),
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);
        assert!(let Err(_) = result);
    }

    #[test]
    fn we_dont_hardcode_native_to_azero() {
        let app_state = AppState {
            native_token: Coin::Btc,
            token_pricing: vec![
                erc20_pricing(),
                TokenPricingConfig {
                    token: TokenKind::Native,
                    pricing: Pricing::Feed {
                        price_feed_coin: Coin::Btc,
                    },
                },
            ],
            ..app_state()
        };
        app_state.prices.set_price(Coin::Btc, Decimal::new(1, 0));
        app_state.prices.set_price(Coin::Eth, Decimal::new(1, 0));

        let query = RelayQuery {
            fee_amount: U256::from(100),
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };

        let result = check_fee(&app_state, &query, &mut RequestTrace::new(&query));
        assert!(let Ok(_) = result);
    }
}
