use std::{
    fmt::{Debug, Formatter},
    str::FromStr,
};

use clap::Parser;
use cli::CLIConfig;
use defaults::*;
pub use enums::{DryRunning, LoggingFormat, NoncePolicy};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use shielder_contract::alloy_primitives::{Address, U256};
use shielder_relayer::*;

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
    pub native_token: Coin,
}

#[derive(Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
pub enum Pricing {
    Fixed { price: Decimal },
    Feed,
}

#[derive(Clone, Eq, PartialEq, Debug, Serialize, Deserialize)]
pub struct TokenConfig {
    pub coin: Coin,
    pub kind: TokenKind,
    pub pricing: Pricing,
}

impl TokenConfig {
    pub fn token_address(&self) -> Option<Address> {
        match self.kind {
            TokenKind::Native => None,
            TokenKind::ERC20(address) => Some(address),
        }
    }
}

#[derive(Clone, Eq, PartialEq, Debug)]
pub struct OperationalConfig {
    pub balance_monitor_interval_secs: u64,
    pub nonce_policy: NoncePolicy,
    pub dry_running: DryRunning,
    pub relay_count_for_recharge: u32,
    pub token_config: Vec<TokenConfig>,
    pub price_feed_validity: u64,
    pub price_feed_refresh_interval: u64,
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
        balance_monitor_interval_secs,
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
        native_token,
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
        total_fee: U256::from_str(&resolve_value(
            total_fee,
            TOTAL_FEE_ENV,
            Some(DEFAULT_TOTAL_FEE.to_string()),
        ))
        .expect("Invalid relay fee"),
        relay_gas: resolve_value(relay_gas, RELAY_GAS_ENV, Some(DEFAULT_RELAY_GAS)),
        native_token: resolve_value(native_token, NATIVE_TOKEN_ENV, None),
    };

    let token_config = token_config
        .or_else(|| std::env::var(TOKEN_CONFIG_ENV).ok())
        .unwrap_or_else(|| "[]".to_string());
    let token_config = serde_json::from_str(&token_config).expect("Invalid token pricing");

    let operational_config = OperationalConfig {
        balance_monitor_interval_secs: resolve_value(
            balance_monitor_interval_secs,
            BALANCE_MONITOR_INTERVAL_SECS_ENV,
            Some(DEFAULT_BALANCE_MONITOR_INTERVAL_SECS),
        ),
        nonce_policy: resolve_value(nonce_policy, NONCE_POLICY_ENV, Some(DEFAULT_NONCE_POLICY)),
        dry_running: resolve_value(dry_running, DRY_RUNNING_ENV, Some(DEFAULT_DRY_RUNNING)),
        relay_count_for_recharge: resolve_value(
            relay_count_for_recharge,
            RELAY_COUNT_FOR_RECHARGE_ENV,
            Some(DEFAULT_RELAY_COUNT_FOR_RECHARGE),
        ),
        token_config,
        price_feed_validity: resolve_value(
            price_feed_validity,
            PRICE_FEED_VALIDITY_ENV,
            Some(DEFAULT_PRICE_FEED_VALIDITY_SECS),
        ),
        price_feed_refresh_interval: resolve_value(
            price_feed_refresh_interval,
            PRICE_FEED_REFRESH_INTERVAL_ENV,
            Some(DEFAULT_PRICE_FEED_REFRESH_INTERVAL_SECS),
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

fn resolve_value<T: FromStr>(value: Option<T>, env_var: &str, default: Option<T>) -> T {
    value.unwrap_or_else(|| {
        std::env::var(env_var)
            .ok()
            .and_then(|v| T::from_str(&v).ok())
            .or(default)
            .expect("Missing required configuration")
    })
}
