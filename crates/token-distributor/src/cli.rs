use std::str::FromStr;

use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, Result};
use clap::Parser;

#[derive(Parser)]
pub struct Config {
    /// The master seed to use for sending funds.
    #[clap(long, value_parser = parse_signer)]
    pub master_seed: PrivateKeySigner,

    /// How many minions to create and endow.
    #[clap(long)]
    pub minions: u32,

    /// The URL of the node to connect to. By default, it connects to a local node.
    #[clap(long, default_value = "http://localhost:8545")]
    pub node_rpc_url: String,
}

fn parse_signer(string: &str) -> Result<PrivateKeySigner> {
    PrivateKeySigner::from_str(string).map_err(|e| anyhow!(e))
}
