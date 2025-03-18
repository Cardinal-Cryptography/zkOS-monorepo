use alloy_primitives::address;
use shielder_contract::{NoProvider, ShielderUser};
use tokio::{sync::mpsc::channel, time::Duration};

use super::*;
use crate::{config::DryRunning, price_feed::Prices, relay::taskmaster::Taskmaster};

const NATIVE_TOTAL_FEE: u64 = 100;

/// Return some app state. Surely not functional, but is sufficient for tests.
/// Total fee is set to `NATIVE_TOTAL_FEE` native tokens. Native token is set to `Coin::Azero`.
fn app_state() -> AppState {
    let (recharge_send, _) = channel::<Address>(10);
    let users: Vec<ShielderUser<NoProvider>> = vec![];
    AppState {
        total_fee: U256::from(NATIVE_TOTAL_FEE),
        prices: Prices::new(&[], Duration::from_secs(10), Duration::from_secs(1)),
        taskmaster: Taskmaster::new(users, DryRunning::Optimistic, recharge_send),
        node_rpc_url: Default::default(),
        balances: Default::default(),
        fee_destination: Default::default(),
        token_config: Default::default(),
        signer_addresses: Default::default(),
        relay_gas: Default::default(),
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
    use rust_decimal::Decimal;
    use shielder_relayer::{PriceProvider, Token};

    use super::*;

    const ERC20_ADDRESS: Address = address!("1111111111111111111111111111111111111111");

    /// ETH price is $1.5
    fn erc20() -> Token {
        Token {
            kind: TokenKind::ERC20(ERC20_ADDRESS),
            decimals: 18,
            price_provider: PriceProvider::Static(Decimal::new(15, 1)),
        }
    }

    /// AZERO price is $3
    fn native() -> Token {
        Token {
            kind: TokenKind::Native,
            decimals: 18,
            price_provider: PriceProvider::Static(Decimal::new(3, 0)),
        }
    }

    #[test]
    fn either_pricing_is_not_set_fails() {
        let mut app_state = AppState {
            token_config: vec![],
            ..app_state()
        };

        let query = RelayQuery {
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            fee_amount: U256::from(100000000),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        // When none is set.
        assert!(let Err(_) = check_fee(&app_state, &query, &mut request_trace));

        // When native is not set.
        app_state.token_config = vec![erc20()];
        app_state.prices = Prices::new(&[erc20()], Duration::from_secs(10), Duration::from_secs(1));
        assert!(let Err(_) = check_fee(&app_state, &query, &mut request_trace));

        // When fee token is not set.
        app_state.token_config = vec![native()];
        app_state.prices =
            Prices::new(&[native()], Duration::from_secs(10), Duration::from_secs(1));
        assert!(let Err(_) = check_fee(&app_state, &query, &mut request_trace));
    }

    /// Return default `AppState` with pricing set:
    ///   - static provider for both ETH and AZERO
    ///   - ETH price is $1.5
    ///   - AZERO price is $3
    fn app_state_with_pricing() -> AppState {
        let token_config = vec![erc20(), native()];
        let app_state = AppState {
            prices: Prices::new(
                &token_config,
                Duration::from_secs(10),
                Duration::from_secs(1),
            ),
            token_config,
            ..app_state()
        };
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
        let app_state = AppState {
            token_config: vec![
                erc20(),
                Token {
                    kind: TokenKind::Native,
                    decimals: 18,
                    price_provider: PriceProvider::Url(String::new()),
                },
            ],
            ..app_state()
        };
        // there is no way of checking AZERO price (we don't configure background
        // price fetching, nor we set the price manually)

        let query = RelayQuery {
            fee_amount: U256::from(200),
            fee_token: TokenKind::ERC20(ERC20_ADDRESS),
            ..RelayQuery::default()
        };
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);
        assert!(let Err(_) = result);
    }
}
