use alloy_provider::{Provider, ProviderBuilder};
use anyhow::Result;
use clap::Parser;

mod cli;

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let config = cli::Config::parse();
    check_connection(&config.node_rpc_url).await?;

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
