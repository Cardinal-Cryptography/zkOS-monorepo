use alloy_provider::{
    fillers::WalletFiller,
    network::{EthereumWallet, TransactionBuilder},
    Provider, ProviderBuilder,
};
use alloy_rpc_types::TransactionRequest;
use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, Result};
use shielder_account::{call_data::Token, ShielderAction};
use shielder_circuits::new_account::NewAccountCircuit;
use shielder_contract::{
    alloy_primitives::U256, call_type::Call, events::get_event, providers::create_simple_provider,
    ShielderContract::NewAccount,
};

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

    println!("⏳ Creating shielder accounts. Every account will shield {SHIELDED_BALANCE}.");
    for actor in actors {
        let call = actor.prepare_new_account_call(&params, &pk, shielded_amount);

        let (tx_hash, block_hash) = actor
            .shielder_user
            .new_account_native::<Call>(call, shielded_amount)
            .await?;

        let new_account_event = get_event::<NewAccount>(&provider, tx_hash, block_hash).await?;

        actor.account.register_action(ShielderAction::new_account(
            shielded_amount,
            new_account_event.newNoteIndex,
            tx_hash,
            Token::Native,
        ));

        println!("  ✅ Shielded tokens for address {}", actor.address());
    }
    Ok(())
}
