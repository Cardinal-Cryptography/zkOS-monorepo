use std::str::FromStr;

use alloy_primitives::U256;
use alloy_provider::{
    fillers::WalletFiller,
    network::{EthereumWallet, TransactionBuilder},
    Provider, ProviderBuilder,
};
use alloy_rpc_types::TransactionRequest;
use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, bail, Result};
use clap::Parser;
use rand::{prelude::StdRng, SeedableRng};

const TOKEN_SCALE: u128 = 1_000_000_000_000_000_000;

#[derive(Parser)]
pub struct Config {
    /// The master seed to use for sending funds.
    #[clap(long, value_parser = parse_signer)]
    pub master_signer: PrivateKeySigner,

    /// How many minions to create and endow.
    #[clap(long)]
    pub minions: u32,

    /// How many TZERO to send to each minion (it will be scaled by 1e18).
    #[clap(long)]
    pub bananas: u32,

    /// Whether to use deterministic addresses for the minions.
    #[clap(long)]
    pub deterministic_addresses: bool,

    /// The URL of the node to connect to. By default, it connects to a local node.
    #[clap(long, default_value = "http://localhost:8545")]
    pub node_rpc_url: String,
}

fn parse_signer(string: &str) -> Result<PrivateKeySigner> {
    PrivateKeySigner::from_str(string).map_err(|e| anyhow!(e))
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    let config = Config::parse();

    if config.deterministic_addresses {
        println!("⚠️ Using deterministic addresses for minions. This is not production-safe!");
    }

    let unsigned_provider = check_connection(&config.node_rpc_url).await?;
    ensure_enough_funds(&unsigned_provider, &config).await?;
    let minions = create_minions(config.minions, config.deterministic_addresses);
    save_minions(&minions);
    endow_minions(&config, &minions).await?;

    println!("✅ All done!");

    Ok(())
}

/// Check the connection to the node at the given URL. If the connection is successful, return a
/// provider that can be used to interact with the node.
async fn check_connection(node: &str) -> Result<impl Provider> {
    let provider = ProviderBuilder::new().on_builtin(node).await?;

    let block_number = provider.get_block_number().await?;
    println!("✅ Connected to node at block number: {}", block_number);

    Ok(provider)
}

/// Ensure that the master account has enough funds to distribute tokens to the recipients.
async fn ensure_enough_funds(provider: &impl Provider, config: &Config) -> Result<()> {
    let master_account = config.master_signer.address();
    let balance = provider.get_balance(master_account).await?;

    let required =
        U256::from(config.minions) * U256::from(config.bananas) * U256::from(TOKEN_SCALE);
    if balance <= required {
        bail!(
            "❌ Master account has insufficient funds. Required: {required}, available: {balance}"
        );
    }
    println!("✅ Master account ({master_account:?}) has sufficient funds to distribute tokens");

    Ok(())
}

/// Create the specified number of minions (keys and addresses).
fn create_minions(count: u32, deterministic: bool) -> Vec<PrivateKeySigner> {
    (0..count)
        .map(|id| match deterministic {
            true => PrivateKeySigner::random_with(&mut StdRng::from_seed(seed(id))),
            false => PrivateKeySigner::random(),
        })
        .collect()
}

/// Generate a deterministic seed for the given ID.
fn seed(id: u32) -> [u8; 32] {
    id.to_be_bytes()
        .into_iter()
        .cycle()
        .take(32)
        .collect::<Vec<_>>()
        .try_into()
        .unwrap()
}

/// Save the minions' keys and addresses to files.
fn save_minions(minions: &[PrivateKeySigner]) {
    let keys = minions
        .iter()
        .map(|m| m.to_bytes().to_string())
        .collect::<Vec<_>>();
    let addresses = minions
        .iter()
        .map(|m| m.address().to_string())
        .collect::<Vec<_>>();

    std::fs::write("minions.keys", keys.join("\n")).unwrap();
    std::fs::write("minions.addresses", addresses.join("\n")).unwrap();

    println!("✅ Minions' keys and addresses saved to files");
}

/// Endow the minions with the specified amount of tokens.
async fn endow_minions(config: &Config, minions: &[PrivateKeySigner]) -> Result<()> {
    // Create signed provider.
    let provider = ProviderBuilder::new()
        .with_recommended_fillers()
        .filler(WalletFiller::new(EthereumWallet::from(
            config.master_signer.clone(),
        )))
        .on_builtin(&config.node_rpc_url)
        .await?;

    let tx = TransactionRequest::default()
        .with_from(config.master_signer.address())
        .with_value(U256::from(config.bananas) * U256::from(TOKEN_SCALE));

    println!("⏳ Endowing minions with bananas.");
    for minion in minions {
        provider
            .send_transaction(tx.clone().with_to(minion.address()))
            .await?
            .watch()
            .await?;
        println!("  ✅ Endowed minion {}", minion.address());
    }

    Ok(())
}
