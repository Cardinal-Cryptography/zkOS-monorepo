use alloy_primitives::address;
use assert2::assert;
use rust_decimal::Decimal;
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
    let balance_monitor_interval = Duration::from_secs(60);
    let node_rpc_url = "http://localhost:8545".to_string();
    let shielder_contract_address = address!("0000000000000000000000000000000000000000");
    let fee_destination_key = "key0".to_string();
    let key1 = "key1".to_string();
    let key2 = "key2".to_string();
    let nonce_policy = DEFAULT_NONCE_POLICY;
    let dry_running = DryRunning::Always;
    let relay_count_for_recharge = DEFAULT_RELAY_COUNT_FOR_RECHARGE;
    let relay_gas: u64 = DEFAULT_RELAY_GAS + 1;
    let token_config = vec![
        TokenInfo {
            kind: TokenKind::Native,
            price_provider: PriceProvider::Url("https://price.feed".to_string()),
        },
        TokenInfo {
            kind: TokenKind::ERC20 {
                address: address!("2222222222222222222222222222222222222222"),
                decimals: 10,
            },
            price_provider: PriceProvider::Static(Decimal::new(123, 2)),
        },
    ];
    let price_feed_refresh_interval = DEFAULT_PRICE_FEED_REFRESH_INTERVAL;
    let price_feed_validity = Duration::from_secs(15);
    let service_fee_percent = DEFAULT_SERVICE_FEE_PERCENT;
    let quote_validity = Duration::from_secs(11);
    let max_pocket_money = U256::from(12);

    let expected_config = ServerConfig {
        logging_format, // from CLI
        network: NetworkConfig {
            host,         // default
            port,         // from env
            metrics_port, // from CLI
        },
        chain: ChainConfig {
            node_rpc_url: node_rpc_url.clone(), // from CLI
            shielder_contract_address,          // from CLI
            relay_gas,                          // from env
        },
        operations: OperationalConfig {
            balance_monitor_interval,    // from env
            nonce_policy,                // default
            dry_running,                 // from CLI
            relay_count_for_recharge,    // default
            token_config,                // from env
            price_feed_refresh_interval, // default
            price_feed_validity,         // from CLI
            service_fee_percent,         // default
            quote_validity,              // from env
            max_pocket_money,            // from CLI
        },
        keys: KeyConfig {
            fee_destination_key: fee_destination_key.clone(), // from env
            signing_keys: vec![key1.clone(), key2.clone()],   // from env
        },
    };

    // ---- CLI configuration. -----------------------------------------------------------------
    let cli_config = CLIConfig {
        logging_format: Some(logging_format),
        host: None,
        port: None,
        metrics_port: Some(metrics_port),
        balance_monitor_interval: None,
        node_rpc_url: Some(node_rpc_url),
        shielder_contract_address: Some(shielder_contract_address.to_string()),
        fee_destination_key: None,
        signing_keys: None,
        nonce_policy: None,
        dry_running: Some(dry_running),
        relay_count_for_recharge: None,
        relay_gas: None,
        token_config: None,
        price_feed_refresh_interval: None,
        price_feed_validity: Some(price_feed_validity),
        service_fee_percent: None,
        quote_validity: None,
        max_pocket_money: Some(max_pocket_money),
    };

    // ---- Environment variables. -----------------------------------------------------------
    unsafe {
        std::env::set_var(RELAYER_PORT_ENV, port.to_string());
        std::env::set_var(
            BALANCE_MONITOR_INTERVAL_ENV,
            balance_monitor_interval.as_secs().to_string(),
        );
        std::env::set_var(FEE_DESTINATION_KEY_ENV, fee_destination_key);
        std::env::set_var(RELAYER_SIGNING_KEYS_ENV, format!("{key1},{key2}"));
        std::env::set_var(RELAY_GAS_ENV, relay_gas.to_string());
        std::env::set_var(TOKEN_CONFIG_ENV, "[]");
        std::env::set_var(QUOTE_VALIDITY_ENV, "11");
        std::env::set_var(
            TOKEN_CONFIG_ENV,
            "[
                {
                    \"kind\":\"Native\",
                    \"price_provider\":{\"Url\":\"https://price.feed\"}
                },
                {
                    \"kind\":{\
                        \"ERC20\": {
                            \"address\": \"0x2222222222222222222222222222222222222222\",
                            \"decimals\": 10
                        }
                    },
                    \"price_provider\":{\"Static\":\"1.23\"}
                }
            ]",
        );
    }

    // ---- Test. ------------------------------------------------------------------------------
    let resolved_config = resolve_config_from_cli_config(cli_config);
    assert!(resolved_config == expected_config);
}
