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
            provided, the value from the environment variable `{BALANCE_MONITOR_INTERVAL_SECS_ENV}` \
            will be used. If that is not set, the default value is \
            `{DEFAULT_BALANCE_MONITOR_INTERVAL_SECS}`.")
    )]
    pub balance_monitor_interval_secs: Option<u64>,

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
        help = "Relay operation fee.",
        long_help = format!("Relay operation fee. If not provided, the value from the \
            environment variable `{RELAY_FEE_ENV}` will be used. If that is not set,\
            the default value is `{DEFAULT_RELAY_FEE:?}`.")
    )]
    pub relay_fee: Option<String>,
}
