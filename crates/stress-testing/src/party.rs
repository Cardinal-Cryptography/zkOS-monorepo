use std::time::Instant;

use alloy_provider::Provider;
use anyhow::Result;
use shielder_account::{
    call_data::{WithdrawCallType, WithdrawExtra},
    Token,
};
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    withdraw::WithdrawCircuit,
};
use shielder_contract::{
    alloy_primitives::U256, merkle_path::get_current_merkle_path,
    providers::create_simple_provider, ShielderContract::withdrawNativeCall,
};
use shielder_relayer::{QuoteFeeQuery, QuoteFeeResponse, RelayCalldata, RelayQuery, RelayQuote};
use shielder_setup::version::contract_version;

use crate::{actor::Actor, config::Config, util::proving_keys, WITHDRAW_AMOUNT};

pub async fn enter_pandemonium(config: &Config, actors: Vec<Actor>) -> Result<()> {
    let task_inputs = prepare_relay_queries(config, actors).await?;
    println!("✅ Prepared relay queries (proof and REST calldata)\n");

    println!("🎉 Entering pandemonium! 🎉");
    let mut handles = vec![];
    for (actor, query) in task_inputs {
        let relayer = config.relayer_url.clone();
        handles.push(tokio::spawn(async move {
            actor_task(actor, query, relayer).await
        }));
    }

    let mut successful = 0;
    for handle in handles {
        match handle.await? {
            Ok(true) => successful += 1,
            Ok(false) => (),
            Err(e) => eprintln!("Error: {:?}", e),
        }
    }
    println!("🎉 Pandemonium is over! 🎉\n");
    println!(
        "🎉 Successful withdrawals: {successful}/{}",
        config.actor_count
    );

    Ok(())
}

async fn actor_task(actor: Actor, query: RelayQuery, relayer_rpc_url: String) -> Result<bool> {
    println!("  🚀 Actor {} is starting the withdrawal...", actor.id);

    let start = Instant::now();
    let status = reqwest::Client::new()
        .post(relayer_rpc_url + "/relay")
        .json(&query)
        .send()
        .await?
        .status();
    let elapsed = start.elapsed();

    if status.is_success() {
        println!("  ✅ Actor {} succeeded! Latency: {elapsed:?}.", actor.id);
        Ok(true)
    } else {
        println!(
            "  ❌ Actor {} failed: {status:?}. Latency: {elapsed:?}.",
            actor.id
        );
        Ok(false)
    }
}

async fn prepare_relay_queries(
    config: &Config,
    actors: Vec<Actor>,
) -> Result<Vec<(Actor, RelayQuery)>> {
    let (params, pk) = proving_keys::<WithdrawCircuit>();
    let mut result = Vec::new();

    let quote = reqwest::Client::new()
        .post(config.relayer_url.clone() + "/quote_fees")
        .json(&QuoteFeeQuery {
            fee_token: Token::Native,
            pocket_money: U256::ZERO,
        })
        .send()
        .await?
        .json::<QuoteFeeResponse>()
        .await?;

    println!("⏳ Preparing relay queries for actors...");
    for actor in actors {
        let query = prepare_relay_query(config, &actor, &params, &pk, quote.clone()).await?;
        result.push((actor, query));
    }
    Ok(result)
}

async fn prepare_relay_query(
    config: &Config,
    actor: &Actor,
    params: &Params,
    pk: &ProvingKey,
    quote: QuoteFeeResponse,
) -> Result<RelayQuery> {
    let (merkle_root, merkle_path) =
        get_current_merkle_path(U256::from(actor.id), &actor.shielder_user).await?;
    let to = config.master_seed.address();
    let chain_id = create_simple_provider(&config.node_rpc_url)
        .await?
        .get_chain_id()
        .await?;
    let amount = U256::from(WITHDRAW_AMOUNT) + quote.fee_details.total_cost_native;

    let calldata: withdrawNativeCall = actor
        .account
        .prepare_call::<WithdrawCallType>(
            params,
            pk,
            Token::Native,
            amount,
            &WithdrawExtra {
                merkle_path,
                to,
                relayer_address: config.relayer_address,
                relayer_fee: quote.fee_details.total_cost_fee_token,
                contract_version: contract_version(),
                chain_id: U256::from(chain_id),
                mac_salt: U256::ZERO,
                pocket_money: U256::ZERO,
            },
        )
        .try_into()
        .unwrap();

    let query = RelayQuery {
        calldata: RelayCalldata {
            expected_contract_version: contract_version().to_bytes(),
            amount,
            withdraw_address: to,
            merkle_root,
            nullifier_hash: calldata.oldNullifierHash,
            new_note: calldata.newNote,
            proof: calldata.proof,
            fee_token: Token::Native,
            fee_amount: calldata.relayerFee,
            mac_salt: calldata.macSalt,
            mac_commitment: calldata.macCommitment,
            pocket_money: U256::ZERO,
        },
        quote: RelayQuote {
            gas_price: quote.price_details.gas_price,
            native_token_unit_price: quote.price_details.native_token_unit_price,
            fee_token_unit_price: quote.price_details.fee_token_unit_price,
        },
    };
    println!("  ✅ Prepared relay query for actor {}", actor.id);
    Ok(query)
}
