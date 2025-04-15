use std::{borrow::Cow, collections::HashMap, fmt::Display};

use shielder_relayer::{
    TokenInfo, BALANCE_MONITOR_INTERVAL_ENV, FEE_DESTINATION_KEY_ENV, NODE_RPC_URL_ENV,
    RELAYER_METRICS_PORT_ENV, RELAYER_PORT_ENV, RELAYER_SIGNING_KEYS_ENV,
    SHIELDER_CONTRACT_ADDRESS_ENV, TOKEN_CONFIG_ENV,
};
use testcontainers::{core::WaitFor, Image};

use crate::utils::config::FEE_DESTINATION_KEY;

/// Wrapper around `shielder-relayer` Docker image.
///
/// # Building image
///
/// Run `make build-relayer-image` in the main repo directory.
///
/// # Ready conditions
///
/// We consider a container healthy after `Listening on ` is written to stdout.
#[derive(Debug)]
pub struct RelayerImage {
    env_vars: HashMap<String, String>,
}

impl RelayerImage {
    pub fn new(
        port: u16,
        metrics_port: u16,
        node_rpc_url: String,
        shielder_address: String,
        signer_key: String,
        token_config: Vec<TokenInfo>,
        balance_monitor_interval: String,
    ) -> Self {
        Self {
            env_vars: HashMap::from([
                (RELAYER_PORT_ENV.to_string(), format!("{port}")),
                (
                    RELAYER_METRICS_PORT_ENV.to_string(),
                    format!("{metrics_port}"),
                ),
                (NODE_RPC_URL_ENV.to_string(), node_rpc_url),
                (SHIELDER_CONTRACT_ADDRESS_ENV.to_string(), shielder_address),
                (
                    FEE_DESTINATION_KEY_ENV.to_string(),
                    FEE_DESTINATION_KEY.to_string(),
                ),
                (RELAYER_SIGNING_KEYS_ENV.to_string(), signer_key),
                (
                    TOKEN_CONFIG_ENV.to_string(),
                    serde_json::to_string(&token_config).unwrap(),
                ),
                (
                    BALANCE_MONITOR_INTERVAL_ENV.to_string(),
                    balance_monitor_interval,
                ),
            ]),
        }
    }
}

impl Image for RelayerImage {
    fn name(&self) -> &str {
        "shielder-relayer"
    }

    fn tag(&self) -> &str {
        "latest"
    }

    fn ready_conditions(&self) -> Vec<WaitFor> {
        vec![
            WaitFor::message_on_stdout("Listening on "),
            WaitFor::message_on_stdout("Exposing metrics on "),
        ]
    }

    fn env_vars(
        &self,
    ) -> impl IntoIterator<Item = (impl Into<Cow<'_, str>>, impl Into<Cow<'_, str>>)> {
        Box::new(self.env_vars.iter())
    }
}
