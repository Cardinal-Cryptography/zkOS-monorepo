use alloy_signer_local::PrivateKeySigner;
use clap::Parser;
use shielder_contract::alloy_primitives::Address;

#[derive(Parser)]
pub struct Config {
    #[clap(long, value_parser = parsing::parse_signer)]
    pub master_seed: PrivateKeySigner,

    #[clap(long)]
    pub actor_count: u32,

    #[clap(long)]
    pub node_rpc_url: String,

    #[clap(long, value_parser = parsing::parse_address)]
    pub shielder: Address,

    #[clap(long)]
    pub relayer_url: String,

    #[clap(long, value_parser = parsing::parse_address)]
    pub relayer_address: Address,
}

mod parsing {
    use std::str::FromStr;

    use alloy_signer_local::PrivateKeySigner;
    use anyhow::{anyhow, Result};
    use shielder_contract::alloy_primitives::Address;

    pub fn parse_address(string: &str) -> Result<Address> {
        Address::from_str(string).map_err(|e| anyhow!(e))
    }

    pub fn parse_signer(string: &str) -> Result<PrivateKeySigner> {
        PrivateKeySigner::from_str(string).map_err(|e| anyhow!(e))
    }
}
