use std::collections::HashMap;

use alloy_provider::{network::TransactionBuilder, Provider};
use alloy_rpc_types::TransactionRequest;
use alloy_signer_local::PrivateKeySigner;
use anyhow::{bail, Result};
use shielder_contract::{
    alloy_primitives::{Address, U256},
    providers::create_provider_with_nonce_caching_signer,
};
use tokio::sync::mpsc::{self, Receiver as MPSCReceiver, Sender as MPSCSender};
use tracing::{error, info};

const RECHARGE_AS_FEE_PERCENT: u32 = 70;

pub fn start_recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    relay_workers: usize,
    relay_count_for_recharge: u32,
) -> MPSCSender<Address> {
    let (relay_report_sender, relay_report_receiver) = mpsc::channel(relay_workers);
    tokio::spawn(recharging_worker(
        node_rpc_url,
        cornucopia,
        relay_report_receiver,
        relay_count_for_recharge,
    ));

    relay_report_sender
}

async fn recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    mut relay_reports: MPSCReceiver<Address>,
    relay_count_for_recharge: u32,
) -> Result<()> {
    let cornucopia_address = cornucopia.address();
    let provider = create_provider_with_nonce_caching_signer(&node_rpc_url, cornucopia).await?;
    let mut accounting = HashMap::<Address, u32>::new();

    while let Some(relayer) = relay_reports.recv().await {
        let count = accounting.entry(relayer).or_insert(0);
        *count += 1;
        info!("Relayer {relayer} reported that it sent a relay tx. Current counter: {count}");

        if *count >= relay_count_for_recharge {
            match recharge_relayer(&provider, relayer, cornucopia_address, *count).await
            {
                Ok(recharge_amount) => {
                    info!("Recharged relayer {relayer} with {recharge_amount}");
                }
                Err(e) => {
                    error!("Failed to recharge relayer {relayer}: {e:?}");
                }
            }
            *count = 0;
        }
    }

    error!("Relay report channel closed");
    bail!("Relay report channel closed");
}

async fn recharge_relayer(
    provider: &impl Provider,
    relayer: Address,
    cornucopia_address: Address,
    relay_count: u32,
) -> Result<U256> {
    let recharge_amount = U256::from(relay_count)
        * (total_fee * U256::from(RECHARGE_AS_FEE_PERCENT) / U256::from(100));

    let tx = TransactionRequest::default()
        .with_from(cornucopia_address)
        .with_value(recharge_amount)
        .with_to(relayer);

    provider.send_transaction(tx).await?.watch().await?;
    Ok(recharge_amount)
}
