use alloy_provider::Provider;
use anyhow::Result;
use shielder_rust_sdk::{
    alloy_primitives::{Address, U256},
    contract::providers::create_simple_provider,
};
use tokio::time::{interval, Duration};
use tracing::error;

use crate::monitor::Balances;

/// Periodically check the balance of the relayer's signer addresses.
pub async fn balance_monitor(
    node_rpc_url: &str,
    interval_secs: u64,
    balances: Balances,
) -> Result<()> {
    let provider = create_simple_provider(node_rpc_url).await?;
    let mut interval = interval(Duration::from_secs(interval_secs));

    loop {
        interval.tick().await;
        for signer in balances.keys() {
            match provider.get_balance(*signer).await {
                Ok(balance) => {
                    set_balance(&balances, *signer, Some(balance)).await;
                }
                Err(err) => {
                    error!("Cannot reach RPC node: {err:?}. Cannot check balance for {signer}");
                    set_balance(&balances, *signer, None).await;
                }
            }
        }
    }
}

async fn set_balance(balances: &Balances, address: Address, balance: Option<U256>) {
    *balances
        .get(&address)
        .expect("Map should be already intialized")
        .write()
        .await = balance;
}
