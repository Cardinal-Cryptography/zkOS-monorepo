use std::str::FromStr;

use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, Result};
use clap::Parser;

#[derive(Parser)]
pub struct Config {
    #[clap(long, value_parser = parsing::parse_signer)]
    pub master_seed: PrivateKeySigner,

    #[clap(long)]
    pub actor_count: u32,

    #[clap(long)]
    pub node_rpc_url: String,
}

fn parse_signer(string: &str) -> Result<PrivateKeySigner> {
    PrivateKeySigner::from_str(string).map_err(|e| anyhow!(e))
}
