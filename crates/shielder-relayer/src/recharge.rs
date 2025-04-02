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

pub async fn start_recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    relay_workers: &[Address],
    recharge_threshold: U256,
    recharge_amount: U256,
) -> MPSCSender<Address> {
    let (relay_report_sender, relay_report_receiver) = mpsc::channel(relay_workers.len());
    tokio::spawn(recharging_worker(
        node_rpc_url,
        cornucopia,
        relay_report_receiver,
        recharge_threshold,
        recharge_amount,
    ));

    // Trigger the recharging worker to ensure that every worker has funds.
    for relayer in relay_workers {
        relay_report_sender
            .send(*relayer)
            .await
            .expect("Relay report channel closed");
    }

    relay_report_sender
}

async fn recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    mut relay_reports: MPSCReceiver<Address>,
    recharge_threshold: U256,
    recharge_amount: U256,
) -> Result<()> {
    let cornucopia_address = cornucopia.address();
    let provider = create_provider_with_nonce_caching_signer(&node_rpc_url, cornucopia).await?;
    while let Some(relayer) = relay_reports.recv().await {
        let relayer_balance = match provider.get_balance(relayer).await {
            Ok(balance) => balance,
            Err(err) => {
                error!("Failed to retrieve balance: {err:?}");
                continue;
            }
        };

        if relayer_balance < recharge_threshold {
            info!("Relayer {relayer} has insufficient funds ({relayer_balance}). Recharging with {recharge_amount}.");
            if let Err(err) =
                recharge_relayer(&provider, relayer, cornucopia_address, recharge_amount).await
            {
                error!("Failed to recharge relayer {relayer} with {recharge_amount}: {err}");
            }
        } else {
            info!(
            "Relayer {relayer} reported another expense. Their current balance: {relayer_balance} - no need to recharge."
        );
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
