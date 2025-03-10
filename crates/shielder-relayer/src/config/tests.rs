use alloy_primitives::address;
use assert2::assert;
use shielder_relayer::{RELAYER_PORT_ENV, RELAYER_SIGNING_KEYS_ENV};

use super::*;

#[test]
fn verify_cli() {
    use clap::CommandFactory;
    CLIConfig::command().debug_assert()
}

#[test]
fn config_resolution() {
    // ---- Target configuration. --------------------------------------------------------------
    let logging_format = LoggingFormat::Json;
    let host = DEFAULT_HOST.to_string();
    let port = 1234;
    let metrics_port = 5678;
    let balance_monitor_interval_secs = 60;
    let node_rpc_url = "http://localhost:8545".to_string();
    let shielder_contract_address = address!("0000000000000000000000000000000000000000");
    let fee_destination_key = "key0".to_string();
    let key1 = "key1".to_string();
    let key2 = "key2".to_string();
    let nonce_policy = DEFAULT_NONCE_POLICY;
    let dry_running = DryRunning::Always;
    let relay_count_for_recharge = DEFAULT_RELAY_COUNT_FOR_RECHARGE;
    let total_fee = DEFAULT_TOTAL_FEE.to_string();
    let relay_gas: u64 = DEFAULT_RELAY_GAS + 1;
    let fee_token_config = vec![
        TokenPricingConfig {
            token: FeeToken::Native,
            pricing: Pricing::Fixed {
                price: Decimal::from_str("1.23").unwrap(),
            },
        },
        TokenPricingConfig {
            token: FeeToken::ERC20(address!("2222222222222222222222222222222222222222")),
            pricing: Pricing::Feed {
                price_feed_coin: Coin::Eth,
            },
        },
    ];
    let price_feed_refresh_interval = DEFAULT_PRICE_FEED_REFRESH_INTERVAL_SECS;
    let price_feed_validity = 15;
    let native_token = Coin::Btc;

    let expected_config = ServerConfig {
        logging_format, // from CLI
        network: NetworkConfig {
            host,         // default
            port,         // from env
            metrics_port, // from CLI
        },
        chain: ChainConfig {
            node_rpc_url: node_rpc_url.clone(),               // from CLI
            shielder_contract_address,                        // from CLI
            fee_destination_key: fee_destination_key.clone(), // from env
            signing_keys: vec![key1.clone(), key2.clone()],   // from env
            total_fee: U256::from_str(&total_fee).unwrap(),   // from CLI
            relay_gas,                                        // from env
            native_token,                                     // from env
        },
        operations: OperationalConfig {
            balance_monitor_interval_secs,   // from env
            nonce_policy,                    // default
            dry_running,                     // from CLI
            relay_count_for_recharge,        // default
            token_pricing: fee_token_config, // from env
            price_feed_refresh_interval,     // default
            price_feed_validity,             // from CLI
        },
    };

    // ---- CLI configuration. -----------------------------------------------------------------
    let cli_config = CLIConfig {
        logging_format: Some(logging_format),
        host: None,
        port: None,
        metrics_port: Some(metrics_port),
        balance_monitor_interval_secs: None,
        node_rpc_url: Some(node_rpc_url),
        shielder_contract_address: Some(shielder_contract_address.to_string()),
        fee_destination_key: None,
        signing_keys: None,
        nonce_policy: None,
        dry_running: Some(dry_running),
        relay_count_for_recharge: None,
        total_fee: Some(total_fee),
        relay_gas: None,
        token_pricing: None,
        price_feed_refresh_interval: None,
        price_feed_validity: Some(price_feed_validity),
        native_token: None,
    };

    // ---- Environment variables. -----------------------------------------------------------
    unsafe {
        std::env::set_var(RELAYER_PORT_ENV, port.to_string());
        std::env::set_var(
            BALANCE_MONITOR_INTERVAL_SECS_ENV,
            balance_monitor_interval_secs.to_string(),
        );
        std::env::set_var(FEE_DESTINATION_KEY_ENV, fee_destination_key);
        std::env::set_var(RELAYER_SIGNING_KEYS_ENV, format!("{key1},{key2}"));
        std::env::set_var(RELAY_GAS_ENV, relay_gas.to_string());
        std::env::set_var(
            TOKEN_PRICING_ENV,
            "[
                {
                    \"token\":\"Native\",
                    \"pricing\":{\"Fixed\":{\"price\":\"1.23\"}}
                },
                {
                    \"token\":{\"ERC20\":\"0x2222222222222222222222222222222222222222\"},
                    \"pricing\":{\"Feed\":{\"price_feed_coin\":\"Eth\"}}
                }
            ]",
        );
        std::env::set_var(NATIVE_TOKEN_ENV, format!("{native_token:?}"));
    }

    // ---- Test. ------------------------------------------------------------------------------
    let resolved_config = resolve_config_from_cli_config(cli_config);
    assert!(resolved_config == expected_config);
}
