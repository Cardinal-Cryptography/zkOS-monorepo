use std::{
    fmt::{Debug, Formatter},
    str::FromStr,
    time::Duration,
};

use anyhow::anyhow;
use clap::Parser;
use cli::CLIConfig;
use defaults::*;
pub use enums::{DryRunning, LoggingFormat, NoncePolicy};
use shielder_contract::alloy_primitives::{Address, U256};
use shielder_relayer::*;

use crate::config::cli::parsing::{parse_seconds, parse_u256};

mod cli;
mod defaults;
mod enums;
#[cfg(test)]
mod tests;

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct NetworkConfig {
    pub host: String,
    pub port: u16,
    pub metrics_port: u16,
}

impl NetworkConfig {
    pub fn main_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    pub fn metrics_address(&self) -> String {
        format!("{}:{}", self.host, self.metrics_port)
    }
}

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct ChainConfig {
    pub node_rpc_url: String,
    pub shielder_contract_address: Address,
    pub total_fee: U256,
    pub relay_gas: u64,
}

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct OperationalConfig {
    pub balance_monitor_interval: Duration,
    pub nonce_policy: NoncePolicy,
    pub dry_running: DryRunning,
    pub relay_count_for_recharge: u32,
    pub token_config: Vec<Token>,
    pub price_feed_validity: Duration,
    pub price_feed_refresh_interval: Duration,
    pub service_fee_percent: u32,
    pub quote_validity: Duration,
    pub max_pocket_money: U256,
}

#[derive(Clone, Eq, PartialEq)]
pub struct KeyConfig {
    pub fee_destination_key: String,
    pub signing_keys: Vec<String>,
}

impl Debug for KeyConfig {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        #[allow(clippy::ptr_arg)]
        fn fmt_key(key: &String) -> String {
            format!("{}...{}", &key[..5], &key[key.len() - 3..])
        }

        f.debug_struct("KeyConfig")
            .field("fee_destination_key", &fmt_key(&self.fee_destination_key))
            .field(
                "signing_keys",
                &self.signing_keys.iter().map(fmt_key).collect::<Vec<_>>(),
            )
            .finish()
    }
}

/// Resolved configuration for the Shielder relayer. Order of precedence is:
/// 1. Command line arguments (`CLIConfig`).
/// 2. Environment variables.
/// 3. Default values (available only for some fields).
///
/// For field documentation, see their counterparts in `CLIConfig`.
#[derive(Clone, Eq, PartialEq, Debug)]
pub struct ServerConfig {
    pub logging_format: LoggingFormat,
    pub network: NetworkConfig,
    pub chain: ChainConfig,
    pub operations: OperationalConfig,
    pub keys: KeyConfig,
}

/// Resolves the configuration for the Shielder relayer using the command line arguments,
/// environment variables, and default values.
pub fn resolve_config() -> ServerConfig {
    resolve_config_from_cli_config(CLIConfig::parse())
}

fn resolve_config_from_cli_config(
    CLIConfig {
        logging_format,
        host,
        port,
        metrics_port,
        balance_monitor_interval,
        node_rpc_url,
        shielder_contract_address,
        fee_destination_key,
        signing_keys,
        nonce_policy,
        dry_running,
        relay_count_for_recharge,
        total_fee,
        relay_gas,
        token_config,
        price_feed_validity,
        price_feed_refresh_interval,
        service_fee_percent,
        quote_validity,
        max_pocket_money,
    }: CLIConfig,
) -> ServerConfig {
    let to_address = |s: &str| Address::from_str(s).expect("Invalid address");

    let signing_keys = signing_keys.unwrap_or_else(|| {
        std::env::var(RELAYER_SIGNING_KEYS_ENV)
            .expect("Missing required configuration")
            .split(',')
            .map(|s| s.to_string())
            .collect()
    });

    let key_config = KeyConfig {
        fee_destination_key: resolve_value(fee_destination_key, FEE_DESTINATION_KEY_ENV, None),
        signing_keys,
    };

    let network_config = NetworkConfig {
        host: resolve_value(host, RELAYER_HOST_ENV, Some(DEFAULT_HOST.to_string())),
        port: resolve_value(port, RELAYER_PORT_ENV, Some(DEFAULT_PORT)),
        metrics_port: resolve_value(
            metrics_port,
            RELAYER_METRICS_PORT_ENV,
            Some(DEFAULT_METRICS_PORT),
        ),
    };

    let chain_config = ChainConfig {
        node_rpc_url: resolve_value(node_rpc_url, NODE_RPC_URL_ENV, None),
        shielder_contract_address: to_address(&resolve_value(
            shielder_contract_address,
            SHIELDER_CONTRACT_ADDRESS_ENV,
            None,
        )),
        total_fee: resolve_value(
            total_fee,
            TOTAL_FEE_ENV,
            Some(parse_u256(DEFAULT_TOTAL_FEE).unwrap()),
        ),
        relay_gas: resolve_value(relay_gas, RELAY_GAS_ENV, Some(DEFAULT_RELAY_GAS)),
    };

    let token_config = token_config
        .or_else(|| std::env::var(TOKEN_CONFIG_ENV).ok())
        .expect("Missing token configuration");
    let token_config = serde_json::from_str(&token_config).expect("Invalid token configuration");

    let operational_config = OperationalConfig {
        balance_monitor_interval: resolve_value_map(
            balance_monitor_interval,
            BALANCE_MONITOR_INTERVAL_ENV,
            parse_seconds,
            Some(DEFAULT_BALANCE_MONITOR_INTERVAL),
        ),
        nonce_policy: resolve_value(nonce_policy, NONCE_POLICY_ENV, Some(DEFAULT_NONCE_POLICY)),
        dry_running: resolve_value(dry_running, DRY_RUNNING_ENV, Some(DEFAULT_DRY_RUNNING)),
        relay_count_for_recharge: resolve_value(
            relay_count_for_recharge,
            RELAY_COUNT_FOR_RECHARGE_ENV,
            Some(DEFAULT_RELAY_COUNT_FOR_RECHARGE),
        ),
        token_config,
        price_feed_validity: resolve_value_map(
            price_feed_validity,
            PRICE_FEED_VALIDITY_ENV,
            parse_seconds,
            Some(DEFAULT_PRICE_FEED_VALIDITY),
        ),
        price_feed_refresh_interval: resolve_value_map(
            price_feed_refresh_interval,
            PRICE_FEED_REFRESH_INTERVAL_ENV,
            parse_seconds,
            Some(DEFAULT_PRICE_FEED_REFRESH_INTERVAL),
        ),
        service_fee_percent: resolve_value(
            service_fee_percent,
            SERVICE_FEE_PERCENT_ENV,
            Some(DEFAULT_SERVICE_FEE_PERCENT),
        ),
        quote_validity: resolve_value_map(
            quote_validity,
            QUOTE_VALIDITY_ENV,
            parse_seconds,
            Some(DEFAULT_QUOTE_VALIDITY),
        ),
        max_pocket_money: resolve_value_map(
            max_pocket_money,
            MAX_POCKET_MONEY_ENV,
            parse_u256,
            Some(parse_u256(DEFAULT_MAX_POCKET_MONEY).unwrap()),
        ),
    };

    ServerConfig {
        logging_format: resolve_value(
            logging_format,
            LOGGING_FORMAT_ENV,
            Some(DEFAULT_LOGGING_FORMAT),
        ),
        network: network_config,
        chain: chain_config,
        operations: operational_config,
        keys: key_config,
    }
}

fn resolve_value<T: FromStr<Err: Debug>>(value: Option<T>, env_var: &str, default: Option<T>) -> T {
    resolve_value_map(
        value,
        env_var,
        |s| T::from_str(s).map_err(|e| anyhow!("{e:?}")),
        default,
    )
}

fn resolve_value_map<T, Map: Fn(&str) -> anyhow::Result<T>>(
    value: Option<T>,
    env_var: &str,
    map: Map,
    default: Option<T>,
) -> T {
    value.unwrap_or_else(|| {
        std::env::var(env_var)
            .ok()
            .and_then(|v| map(&v).ok())
            .or(default)
            .expect("Missing required configuration")
    })
}
