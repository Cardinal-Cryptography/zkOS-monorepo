use std::time::Duration;

use alloy_primitives::U256;
use clap::Parser;
use shielder_relayer::*;

use crate::config::{
    defaults::*,
    enums::{DryRunning, LoggingFormat, NoncePolicy},
};

/// Configuration for the Shielder relayer through the command line arguments.
///
/// All fields are optional, as they can be provided either through environment variables or,
/// in some cases, through default values.
#[derive(Clone, Debug, Parser)]
pub struct CLIConfig {
    #[clap(
        long,
        value_enum,
        help = "Logging format configuration.",
        long_help = format!("Logging format configuration. If not provided, the value from the \
            environment variable `{LOGGING_FORMAT_ENV}` will be used. If that is not set, the \
            default value is `{DEFAULT_LOGGING_FORMAT:?}`.")
    )]
    pub logging_format: Option<LoggingFormat>,

    #[clap(
        long,
        help = "Host where the server should be run.",
        long_help = format!("Host where the server should be run. If not provided, the value from the \
            environment variable `{RELAYER_HOST_ENV}` will be used. If that is not set, the \
            default value is `{DEFAULT_HOST}`.")
    )]
    pub host: Option<String>,

    #[clap(
        long,
        help = "Port where the server should be run.",
        long_help = format!("Port where the server should be run. If not provided, the value from the \
            environment variable `{RELAYER_PORT_ENV}` will be used. If that is not set, the \
            default value is `{DEFAULT_PORT}`.")
    )]
    pub port: Option<u16>,

    #[clap(
        long,
        help = "Port where the server metrics should be exposed.",
        long_help = format!("Port where the server metrics should be exposed. If not provided, the \
            value from the environment variable `{RELAYER_METRICS_PORT_ENV}` will be used. If that \
            is not set, the default value is `{DEFAULT_METRICS_PORT}`.")
    )]
    pub metrics_port: Option<u16>,

    #[clap(
        long,
        help = "Interval (in seconds) for monitoring signers' balances.",
        long_help = format!("Interval (in seconds) for monitoring signers' balances. If not \
            provided, the value from the environment variable `{BALANCE_MONITOR_INTERVAL_ENV}` \
            will be used. If that is not set, the default value is \
            `{}`.", DEFAULT_BALANCE_MONITOR_INTERVAL.as_secs()),
        value_parser = parsing::parse_seconds
    )]
    pub balance_monitor_interval: Option<Duration>,

    #[clap(
        long,
        help = "URL of the Ethereum RPC node.",
        long_help = format!("URL of the Ethereum RPC node. If not provided, the value from the \
            environment variable `{NODE_RPC_URL_ENV}` will be used.")
    )]
    pub node_rpc_url: Option<String>,

    #[clap(
        long,
        help = "Address of the Shielder contract.",
        long_help = format!("Address of the Shielder contract. If not provided, the value from the \
            environment variable `{SHIELDER_CONTRACT_ADDRESS_ENV}` will be used.")
    )]
    pub shielder_contract_address: Option<String>,

    #[clap(
        long,
        help = "Fee destination signing key.",
        long_help = format!("Signing key of the address where the fees should go. If not provided, \
        the value from the environment variable `{FEE_DESTINATION_KEY_ENV}` will be used.")
    )]
    pub fee_destination_key: Option<String>,

    #[clap(
        long,
        help = "Signing keys of the relayer.",
        long_help = format!("Signing keys of the relayer. If not provided, the value from the \
            environment variable `{RELAYER_SIGNING_KEYS_ENV}` will be used."),
        num_args = 1..
    )]
    pub signing_keys: Option<Vec<String>>,

    #[clap(
        long,
        value_enum,
        help = "Nonce management policy.",
        long_help = format!("Nonce management policy. If not provided, the value from the \
            environment variable `{NONCE_POLICY_ENV}` will be used. If that is not set, the \
            default value is `{DEFAULT_NONCE_POLICY:?}`.")
    )]
    pub nonce_policy: Option<NoncePolicy>,

    #[clap(
        long,
        value_enum,
        help = "Dry running policy.",
        long_help = format!("Dry running policy. If not provided, the value from the \
            environment variable `{DRY_RUNNING_ENV}` will be used. If that is not set, the \
            default value is `{DEFAULT_DRY_RUNNING:?}`.")
    )]
    pub dry_running: Option<DryRunning>,

    #[clap(
        long,
        value_enum,
        help = "How many relays must a single relayer do to get a recharge.",
        long_help = format!("Relay count for recharge. If not provided, the value from the \
            environment variable `{RELAY_COUNT_FOR_RECHARGE_ENV}` will be used. If that is not set,\
            the default value is `{DEFAULT_RELAY_COUNT_FOR_RECHARGE:?}`.")
    )]
    pub relay_count_for_recharge: Option<u32>,

    #[clap(
        long,
        help = "Total fee.",
        long_help = format!("The total fee, which is used as an argument for `withdraw_native` call. \
            It should be a fixed value, close to a sum of 'withdraw_native' on-chain gas cost and the intended relayer fee. \
            If not provided, the value from the environment variable `{TOTAL_FEE_ENV}` will be used. \
            If that is not set, the default value is `{DEFAULT_TOTAL_FEE:?}`."),
        value_parser = parsing::parse_u256
    )]
    pub total_fee: Option<U256>,

    #[clap(
        long,
        help = "Relay gas amount.",
        long_help = format!("The estimated amount of gas 'withdraw_native' on-chain call burns. If not provided, the value from the \
            environment variable `{RELAY_GAS_ENV}` will be used. If that is not set,\
            the default value is `{DEFAULT_RELAY_GAS:?}`.")
    )]
    pub relay_gas: Option<u64>,

    #[clap(
        long,
        help = "Token configuration for all coins that are qualified as a fee token.",
        long_help = format!("Token configuration for all coins that are qualified as a fee token. \
            If not provided, the value from the environment variable `{TOKEN_CONFIG_ENV}` will be used. \
            \
            Parsed as JSON: \
            \
            This example configures a token to have a constant price of 12.3 USD: \
            [{{\"coin\":\"Eth\", \"kind\":\"Native\", \"pricing\":{{\"Fixed\":{{\"price\":\"12.3\"}}}}] \
            \
            This example configure a token to use the `Usdc` price feed for its pricing: \
            [{{\"coin\":\"Usdc\", \"kind\":{{\"ERC20\":\"0x6b175474e89094c44da98b954eedeac495271d0f\"}},\"pricing\":\"Feed\"}}]
            ")
    )]
    pub token_config: Option<String>,

    #[clap(
        long,
        help = "Price feed refresh interval in seconds.",
        long_help = format!("Price feed refresh interval in seconds. If not provided, the value from the \
            environment variable `{PRICE_FEED_REFRESH_INTERVAL_ENV}` will be used. If that is not set,\
            the default value is `{DEFAULT_PRICE_FEED_REFRESH_INTERVAL:?}`."),
        value_parser = parsing::parse_seconds
    )]
    pub price_feed_refresh_interval: Option<Duration>,

    #[clap(
        long,
        help = "Price feed validity in seconds.",
        long_help = format!("Price feed validity in seconds. If not provided, the value from the \
            environment variable `{PRICE_FEED_VALIDITY_ENV}` will be used. If that is not set,\
            the default value is `{DEFAULT_PRICE_FEED_VALIDITY:?}`."),
        value_parser = parsing::parse_seconds
    )]
    pub price_feed_validity: Option<Duration>,

    #[clap(
        long,
        help = "Commission fee percentage (added to the actual relay cost).",
        long_help = format!("Commission fee percentage (added to the actual relay cost). If not \
        provided, the value from the environment variable `{SERVICE_FEE_PERCENT_ENV}` will be used.\
        If that is not set, the default value is `{DEFAULT_SERVICE_FEE_PERCENT}`.")
    )]
    pub service_fee_percent: Option<u32>,

    #[clap(
        long,
        help = "How long the quote provided by the service is valid. In seconds.",
        long_help = format!("How long the quote provided by the service is valid. In seconds. If not \
            provided, the value from the environment variable `{QUOTE_VALIDITY_ENV}` will be used.\
            If that is not set, the default value is `{}`.", DEFAULT_QUOTE_VALIDITY.as_secs()),
        value_parser = parsing::parse_seconds
    )]
    pub quote_validity: Option<Duration>,

    #[clap(
        long,
        help = "Maximum pocket money relayer can provide.",
        long_help = format!("Maximum pocket money relayer can provide. If not provided, the value \
            from the environment variable `{MAX_POCKET_MONEY_ENV}` will be used. If that is not set, \
            the default value is `{DEFAULT_MAX_POCKET_MONEY}`."),
        value_parser = parsing::parse_u256
    )]
    pub max_pocket_money: Option<U256>,
}

pub(super) mod parsing {
    use std::{str::FromStr, time::Duration};

    use alloy_primitives::U256;

    pub fn parse_seconds(string: &str) -> anyhow::Result<Duration> {
        Ok(Duration::from_secs(string.parse::<u64>()?))
    }

    pub fn parse_u256(string: &str) -> anyhow::Result<U256> {
        Ok(U256::from_str(string)?)
    }
}
