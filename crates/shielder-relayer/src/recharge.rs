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

#[derive(Copy, Clone, Debug)]
pub struct RelayCostReport {
    pub relayer: Address,
    pub cost: U256,
}

pub fn start_recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    relay_workers: usize,
    recharge_threshold: U256,
) -> MPSCSender<RelayCostReport> {
    let (relay_report_sender, relay_report_receiver) = mpsc::channel(relay_workers);
    tokio::spawn(recharging_worker(
        node_rpc_url,
        cornucopia,
        relay_report_receiver,
        recharge_threshold,
    ));

    relay_report_sender
}

async fn recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    mut relay_reports: MPSCReceiver<RelayCostReport>,
    recharge_threshold: U256,
) -> Result<()> {
    let cornucopia_address = cornucopia.address();
    let provider = create_provider_with_nonce_caching_signer(&node_rpc_url, cornucopia).await?;
    let mut accounting = HashMap::<Address, U256>::new();

    while let Some(RelayCostReport { relayer, cost }) = relay_reports.recv().await {
        let so_far = accounting.entry(relayer).or_insert(U256::ZERO);
        *so_far += cost;
        info!("Relayer {relayer} reported that it spent {cost}. Accumulated expenses: {so_far}");

        if *so_far >= recharge_threshold {
            match recharge_relayer(&provider, relayer, cornucopia_address, *so_far).await {
                Ok(()) => {
                    info!("Recharged relayer {relayer} with {so_far}");
                }
                Err(e) => {
                    error!("Failed to recharge relayer {relayer}: {e:?}");
                }
            }
            *so_far = U256::ZERO;
        }
    }

    error!("Relay report channel closed");
    bail!("Relay report channel closed");
}

async fn recharge_relayer(
    provider: &impl Provider,
    relayer: Address,
    cornucopia_address: Address,
    recharge_amount: U256,
) -> Result<()> {
    let tx = TransactionRequest::default()
        .with_from(cornucopia_address)
        .with_value(recharge_amount)
        .with_to(relayer);
    provider.send_transaction(tx).await?.watch().await?;
    Ok(())
}
