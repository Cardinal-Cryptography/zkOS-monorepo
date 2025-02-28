use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use rust_decimal::Decimal;
use shielder_contract::{
    alloy_primitives::{Address, U256},
    ShielderContract::withdrawNativeCall,
};
use shielder_relayer::{server_error, FeeToken, RelayQuery, RelayResponse, SimpleServiceResponse};
use shielder_setup::version::{contract_version, ContractVersion};
use tracing::{debug, error};

pub use crate::relay::taskmaster::Taskmaster;
use crate::{
    config::{
        FeeTokenConfig,
        Pricing::{self},
    },
    metrics::WITHDRAW_FAILURE,
    price_feed::Coin,
    relay::{request_trace::RequestTrace, taskmaster::TaskResult},
    AppState,
};

mod monitoring;
mod request_trace;
mod taskmaster;

const TASK_QUEUE_SIZE: usize = 1024;
const OPTIMISTIC_DRY_RUN_THRESHOLD: u32 = 32;
const RELATIVE_PRICE_DIGITS: u32 = 20;
const FEE_MARGIN_PERCENT: u32 = 10;

pub async fn relay(app_state: State<AppState>, Json(query): Json<RelayQuery>) -> impl IntoResponse {
    debug!("Relay request received: {query:?}");
    let mut request_trace = RequestTrace::new(&query);

    if let Err(response) = check_expected_version(&query, &mut request_trace) {
        return response;
    }
    if let Err(response) = check_fee(&app_state, &query, &mut request_trace) {
        return response;
    }

    let withdraw_call = create_call(query, app_state.fee_destination, app_state.total_fee);
    let Ok(rx) = app_state
        .taskmaster
        .register_new_task(withdraw_call, request_trace)
        .await
    else {
        error!("Failed to register new task");
        return server_error("Failed to register new task");
    };

    match rx.await {
        Ok((mut request_trace, task_result)) => match task_result {
            TaskResult::Ok(tx_hash) => {
                request_trace.record_success(tx_hash);
                (StatusCode::OK, RelayResponse::from(tx_hash)).into_response()
            }
            TaskResult::DryRunFailed(err) => {
                request_trace.record_dry_run_failure(err);
                bad_request("Dry run failed")
            }
            TaskResult::RelayFailed(err) => {
                request_trace.record_failure(err);
                bad_request("Relay failed")
            }
        },
        Err(err) => {
            error!("[UNEXPECTED] Relay task master failed: {err}");
            metrics::counter!(WITHDRAW_FAILURE).increment(1);
            server_error("Relay task failed")
        }
    }
}

fn bad_request(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, SimpleServiceResponse::from(msg)).into_response()
}

fn temporary_failure(msg: &str) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        SimpleServiceResponse::from(msg),
    )
        .into_response()
}

fn internal_server_error(msg: &str) -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        SimpleServiceResponse::from(msg),
    )
        .into_response()
}

fn create_call(q: RelayQuery, relayer_address: Address, relayer_fee: U256) -> withdrawNativeCall {
    withdrawNativeCall {
        expectedContractVersion: q.expected_contract_version,
        idHiding: q.id_hiding,
        withdrawalAddress: q.withdraw_address,
        relayerAddress: relayer_address,
        relayerFee: relayer_fee,
        amount: q.amount,
        merkleRoot: q.merkle_root,
        oldNullifierHash: q.nullifier_hash,
        newNote: q.new_note,
        proof: q.proof,
        macSalt: q.mac_salt,
        macCommitment: q.mac_commitment,
    }
}

fn check_expected_version(
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let expected_by_client = ContractVersion::from_bytes(query.expected_contract_version);
    let expected_by_relayer = contract_version();

    if expected_by_client != expected_by_relayer {
        request_trace.record_version_mismatch(expected_by_relayer, expected_by_client);
        return Err(bad_request(&format!(
            "Version mismatch: relayer expects {}, client expects {}",
            expected_by_relayer.to_bytes(),
            expected_by_client.to_bytes()
        )));
    }
    Ok(())
}

fn check_fee(
    app_state: &AppState,
    query: &RelayQuery,
    request_trace: &mut RequestTrace,
) -> Result<(), Response> {
    let permissible_tokens = &app_state.fee_token_config;
    match &query.fee_token {
        FeeToken::ERC20(erc20) => match permissible_tokens.iter().find(|x| x.address == *erc20) {
            None => {
                request_trace.record_incorrect_token_fee(erc20);
                return Err(bad_request(&format!(
                "Fee token {erc20} is not allowed. Only native and {permissible_tokens:?} tokens are supported."
            )));
            }
            Some(FeeTokenConfig { pricing, .. }) => {
                let price = price_relative_to_native(app_state, pricing).ok_or_else(|| {
                    temporary_failure("Verification failed temporarily, try again later.")
                })?;
                let coin_fee = mul_price(query.fee_amount, price)?;

                if add_fee_error_margin(coin_fee) < app_state.total_fee {
                    return Err(bad_request("Insufficient fee."));
                }
            }
        },
        _ => {
            if query.fee_amount < app_state.total_fee {
                return Err(bad_request("Insufficient fee."));
            }
        }
    }

    Ok(())
}

fn price_relative_to_native(app_state: &AppState, pricing: &Pricing) -> Option<Decimal> {
    match pricing {
        Pricing::ProdMode { price_feed_coin } => {
            app_state.prices.relative_price(Coin::Eth, *price_feed_coin)
        }
        Pricing::DevMode { price } => app_state
            .prices
            .price(Coin::Eth)
            .map(|native| price / native),
    }
}

fn mul_price(a: U256, b: Decimal) -> Result<U256, Response> {
    let b = b
        .round_sf(RELATIVE_PRICE_DIGITS)
        .ok_or_else(|| internal_server_error("Pricing error"))?;
    let mantissa: U256 = b
        .mantissa()
        .try_into()
        .map_err(|_| internal_server_error("Pricing error"))?;
    let scale = U256::pow(U256::from(10), U256::from(b.scale()));

    Ok(a * mantissa / scale)
}

fn add_fee_error_margin(fee: U256) -> U256 {
    fee * U256::from(100 + FEE_MARGIN_PERCENT) / U256::from(100)
}

#[cfg(test)]
mod test {
    use alloy_primitives::address;
    use alloy_provider::RootProvider;
    use assert2::assert;
    use shielder_contract::ShielderUser;
    use tokio::{sync::mpsc::channel, time::Duration};

    use super::*;
    use crate::{config::DryRunning, price_feed::Prices, relay::taskmaster::Taskmaster};

    #[test]
    fn test_native_fee_too_low() {
        let mut app_state = app_state();
        app_state.total_fee = U256::from(100);
        let mut query = relay_query();
        query.fee_amount = U256::from(80);
        query.fee_token = FeeToken::Native;
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Err(_) = result);
    }

    #[test]
    fn test_native_fee_ok() {
        let mut app_state = app_state();
        app_state.total_fee = U256::from(100);
        let mut query = relay_query();
        query.fee_amount = U256::from(100);
        query.fee_token = FeeToken::Native;
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Ok(_) = result);
    }

    #[test]
    fn test_erc20_fee_too_low() {
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
        let mut query = relay_query();
        query.fee_amount = U256::from(160);
        query.fee_token = FeeToken::ERC20(coin_address);
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Err(_) = result);
    }

    #[test]
    fn test_erc20_fee_ok() {
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
        let mut query = relay_query();
        query.fee_amount = U256::from(190);
        query.fee_token = FeeToken::ERC20(coin_address);
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Ok(_) = result);
    }

    #[test]
    fn test_erc20_fee_not_allowed() {
        let coin_address = address!("1111111111111111111111111111111111111111");
        let mut app_state = app_state();
        app_state.total_fee = U256::from(100);
        let mut query = relay_query();
        query.fee_amount = U256::from(100);
        query.fee_token = FeeToken::ERC20(coin_address);
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Err(_) = result);
    }

    #[test]
    fn test_erc20_fee_dev_mode() {
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
        let mut query = relay_query();
        query.fee_amount = U256::from(200);
        query.fee_token = FeeToken::ERC20(coin_address);
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Ok(_) = result);
    }

    #[test]
    fn test_erc20_fee_prod_mode_price_feed_error() {
        let coin_address = address!("1111111111111111111111111111111111111111");
        let mut app_state = app_state();
        app_state.total_fee = U256::from(100);
        app_state.fee_token_config = vec![FeeTokenConfig {
            address: coin_address,
            pricing: Pricing::ProdMode {
                price_feed_coin: Coin::Azero,
            },
        }];
        let mut query = relay_query();
        query.fee_amount = U256::from(200);
        query.fee_token = FeeToken::ERC20(coin_address);
        let mut request_trace = RequestTrace::new(&query);

        let result = check_fee(&app_state, &query, &mut request_trace);

        assert!(let Err(_) = result);
    }

    fn app_state() -> AppState {
        let (send, _) = channel::<Address>(10);
        let users: Vec<ShielderUser<RootProvider<_, _>>> = vec![];
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

    fn relay_query() -> RelayQuery {
        RelayQuery {
            expected_contract_version: Default::default(),
            id_hiding: U256::from(0),
            amount: U256::from(0),
            withdraw_address: Default::default(),
            merkle_root: U256::from(0),
            nullifier_hash: U256::from(0),
            new_note: U256::from(0),
            proof: Default::default(),
            fee_token: FeeToken::Native,
            fee_amount: U256::from(0),
            mac_salt: U256::from(0),
            mac_commitment: U256::from(0),
        }
    }
}
