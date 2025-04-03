use alloy_provider::Provider;
use anyhow::Result;
use shielder_contract::{
    alloy_primitives::{Address, U256},
    providers::create_simple_provider,
};
use tokio::time::{interval, Duration};
use tracing::error;

use crate::monitor::Balances;

/// Periodically check the balance of the relayer's signer addresses.
pub async fn balance_monitor(
    node_rpc_url: &str,
    interval_duration: Duration,
    balances: Balances,
) -> Result<()> {
    let mut interval = interval(interval_duration);

    loop {
        interval.tick().await;
        let _ = update_balances(&balances, node_rpc_url).await;
    }
}

pub async fn update_balances(balances: &Balances, node_rpc_url: &str) -> Result<()> {
    let provider = create_simple_provider(node_rpc_url).await.map_err(|err| {
        error!("Cannot reach RPC node: {err:?}");
        err
    })?;

    for signer in balances.keys() {
        match provider.get_balance(*signer).await {
            Ok(balance) => {
                set_balance(balances, *signer, Some(balance)).await;
            }
            Err(err) => {
                error!("Cannot reach RPC node: {err:?}. Cannot check balance for {signer}");
                set_balance(balances, *signer, None).await;
            }
        }
    }
    Ok(())
}

async fn set_balance(balances: &Balances, address: Address, balance: Option<U256>) {
    *balances
        .get(&address)
        .expect("Map should be already intialized")
        .write()
        .await = balance;
}
