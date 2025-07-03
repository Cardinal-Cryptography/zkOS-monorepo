use alloy_provider::{
    fillers::WalletFiller,
    network::{EthereumWallet, TransactionBuilder},
    Provider, ProviderBuilder,
};
use alloy_rpc_types::TransactionRequest;
use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, Result};
use shielder_account::{ShielderAction, Token};
use shielder_circuits::new_account::NewAccountCircuit;
use shielder_contract::{
    alloy_primitives::U256,
    call_type::{Call, DryRun},
    events::get_event,
    providers::create_simple_provider,
    ShielderContract::NewAccount,
};
use shielder_setup::protocol_fee::compute_protocol_fee_from_net;

use crate::{actor::Actor, config::Config, util::proving_keys, INITIAL_BALANCE, SHIELDED_BALANCE};

pub async fn setup_world(config: &Config) -> Result<Vec<Actor>> {
    let mut actors = generate_actors(config);
    println!("✅ Generated actors (seeds and empty accounts)\n");

    distribute_tokens(config, &actors).await?;
    println!("✅ Distributed tokens to actors\n");

    shield_tokens(config, &mut actors).await?;
    println!("✅ Actors have opened shielder accounts\n");

    Ok(actors)
}

fn generate_actors(config: &Config) -> Vec<Actor> {
    (0..config.actor_count)
        .map(|id| Actor::new(id, config.node_rpc_url.clone(), config.shielder))
        .collect()
}

async fn prepare_provider(node_rpc_url: &str, signer: PrivateKeySigner) -> Result<impl Provider> {
    ProviderBuilder::new()
        .with_recommended_fillers()
        .filler(WalletFiller::new(EthereumWallet::from(signer)))
        .on_builtin(node_rpc_url)
        .await
        .map_err(|e| anyhow!(e))
}

async fn distribute_tokens(config: &Config, actors: &[Actor]) -> Result<()> {
    let provider = prepare_provider(&config.node_rpc_url, config.master_seed.clone()).await?;

    let tx = TransactionRequest::default()
        .with_from(config.master_seed.address())
        .with_value(U256::from(INITIAL_BALANCE));

    println!("⏳ Endowing actors with initial balance of {INITIAL_BALANCE}.");
    for actor in actors {
        provider
            .send_transaction(tx.clone().with_to(actor.address()))
            .await?
            .watch()
            .await?;
        println!("  ✅ Endowed address {}", actor.address());
    }
    Ok(())
}

async fn shield_tokens(config: &Config, actors: &mut [Actor]) -> Result<()> {
    let (params, pk) = proving_keys::<NewAccountCircuit>();
    let shielded_amount = U256::from(SHIELDED_BALANCE);
    let provider = create_simple_provider(&config.node_rpc_url).await?;

    let protocol_fee = if let Some(actor) = actors.get(0) {
        let protocol_fee_bps = actor
            .shielder_user
            .protocol_deposit_fee_bps::<DryRun>()
            .await?;
        compute_protocol_fee_from_net(shielded_amount, protocol_fee_bps)
    } else {
        U256::ZERO
    };
    let total_amount = shielded_amount + protocol_fee;

    println!(
        "⏳ Creating shielder accounts. Every account will shield {} plus the {} protocol fee.",
        shielded_amount, protocol_fee
    );
    for actor in actors {
        let call = actor.prepare_new_account_call(&params, &pk, total_amount, protocol_fee);

        let (tx_hash, block_hash) = actor
            .shielder_user
            .new_account_native::<Call>(call, total_amount)
            .await?;

        let new_account_event = get_event::<NewAccount>(&provider, tx_hash, block_hash).await?;

        actor.account.register_action(ShielderAction::new_account(
            total_amount,
            new_account_event.newNoteIndex,
            tx_hash,
            Token::Native,
            protocol_fee,
        ));

        println!("  ✅ Shielded tokens for address {}", actor.address());
    }
    Ok(())
}
