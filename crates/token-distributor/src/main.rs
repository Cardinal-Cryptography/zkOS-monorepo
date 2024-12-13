use alloy_primitives::U256;
use alloy_provider::{Provider, ProviderBuilder};
use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, bail, Result};
use clap::Parser;

use crate::cli::Config;

const TOKEN_SCALE: u128 = 1_000_000_000_000_000_000;

mod cli;

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let config = cli::Config::parse();

    let provider = check_connection(&config.node_rpc_url).await?;
    ensure_enough_funds(&provider, &config).await?;

    Ok(())
}

/// Ensure that the master account has enough funds to distribute tokens to the recipients.
async fn ensure_enough_funds(provider: &impl Provider, config: &Config) -> Result<()> {
    let master_account = config.master_seed.address();
    let balance = provider.get_balance(master_account).await?;

    let required =
        U256::from(config.minions) * U256::from(config.bananas) * U256::from(TOKEN_SCALE);
    if balance <= required {
        bail!("Master account has insufficient funds. Required: {required}, available: {balance}");
    }
    println!("Master account has sufficient funds to distribute tokens");

    Ok(())
}

/// Check the connection to the node at the given URL. If the connection is successful, return a
/// provider that can be used to interact with the node.
async fn check_connection(node: &str) -> Result<impl Provider> {
    let provider = ProviderBuilder::new().on_builtin(node).await?;

    let block_number = provider.get_block_number().await?;
    println!("Connected to node at block number: {}", block_number);

    Ok(provider)
}
