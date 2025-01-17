use std::str::FromStr;

use clap::Parser;
use cli::CLIConfig;
use defaults::{
    DEFAULT_DRY_RUNNING, DEFAULT_HOST, DEFAULT_LOGGING_FORMAT, DEFAULT_METRICS_PORT,
    DEFAULT_NONCE_POLICY, DEFAULT_PORT, DEFAULT_RELAY_GAS, DEFAULT_TOTAL_FEE,
};
pub use enums::{DryRunning, LoggingFormat, NoncePolicy};
use shielder_contract::alloy_primitives::{Address, U256};
use shielder_relayer::{
    BALANCE_MONITOR_INTERVAL_SECS_ENV, DRY_RUNNING_ENV, FEE_DESTINATION_KEY_ENV,
    LOGGING_FORMAT_ENV, NODE_RPC_URL_ENV, NONCE_POLICY_ENV, RELAYER_HOST_ENV,
    RELAYER_METRICS_PORT_ENV, RELAYER_PORT_ENV, RELAYER_SIGNING_KEYS_ENV,
    RELAY_COUNT_FOR_RECHARGE_ENV, RELAY_GAS_ENV, SHIELDER_CONTRACT_ADDRESS_ENV, TOTAL_FEE_ENV,
};

use crate::config::defaults::{
    DEFAULT_BALANCE_MONITOR_INTERVAL_SECS, DEFAULT_RELAY_COUNT_FOR_RECHARGE,
};

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
    pub fee_destination_key: String,
    pub signing_keys: Vec<String>,
    pub total_fee: U256,
    pub relay_gas: u64,
}

#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub struct OperationalConfig {
    pub balance_monitor_interval_secs: u64,
    pub nonce_policy: NoncePolicy,
    pub dry_running: DryRunning,
    pub relay_count_for_recharge: u32,
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
        fee_destination_key: resolve_value(fee_destination_key, FEE_DESTINATION_KEY_ENV, None),
        signing_keys,
        total_fee: U256::from_str(&resolve_value(
            total_fee,
            TOTAL_FEE_ENV,
            Some(DEFAULT_TOTAL_FEE.to_string()),
        ))
        .expect("Invalid relay fee"),
        relay_gas: resolve_value(relay_gas, RELAY_GAS_ENV, Some(DEFAULT_RELAY_GAS)),
    };

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
