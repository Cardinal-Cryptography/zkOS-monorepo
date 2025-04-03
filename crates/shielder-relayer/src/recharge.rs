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

pub async fn ensure_workers_are_funded(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    relay_workers: &[Address],
    recharge_threshold: U256,
    recharge_amount: U256,
) -> Result<()> {
    let cornucopia_address = cornucopia.address();
    let provider = create_provider_with_nonce_caching_signer(&node_rpc_url, cornucopia).await?;
    for worker in relay_workers {
        try_recharging_worker(
            *worker,
            &provider,
            cornucopia_address,
            recharge_threshold,
            recharge_amount,
        )
        .await?;
    }
    Ok(())
}

pub async fn start_recharging_worker(
    node_rpc_url: String,
    cornucopia: PrivateKeySigner,
    num_workers: usize,
    recharge_threshold: U256,
    recharge_amount: U256,
) -> MPSCSender<Address> {
    let (relay_report_sender, relay_report_receiver) = mpsc::channel(num_workers);
    tokio::spawn(recharging_worker(
        node_rpc_url,
        cornucopia,
        relay_report_receiver,
        recharge_threshold,
        recharge_amount,
    ));

    relay_report_sender
}

pub async fn try_recharging_worker(
    worker: Address,
    provider: &impl Provider,
    recharger_address: Address,
    recharge_threshold: U256,
    recharge_amount: U256,
) -> Result<()> {
    let relayer_balance = match provider.get_balance(worker).await {
        Ok(balance) => balance,
        Err(err) => {
            let msg = format!("Failed to retrieve balance: {err:?}");
            error!(msg);
            bail!(msg);
        }
    };

    if relayer_balance < recharge_threshold {
        info!("Relayer {worker} has insufficient funds ({relayer_balance}). Recharging with {recharge_amount}.");
        if let Err(err) =
            recharge_relayer(&provider, worker, recharger_address, recharge_amount).await
        {
            let msg = format!("Failed to recharge relayer {worker} with {recharge_amount}: {err}");
            error!(msg);
            bail!(msg);
        } else {
            Ok(())
        }
    } else {
        info!("Relayer {worker} balance: {relayer_balance} - no need to recharge.");
        Ok(())
    }
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
        let _ = try_recharging_worker(
            relayer,
            &provider,
            cornucopia_address,
            recharge_threshold,
            recharge_amount,
        )
        .await;
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
