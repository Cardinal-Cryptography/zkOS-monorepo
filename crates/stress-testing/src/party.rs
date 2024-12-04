use std::time::Instant;

use anyhow::Result;
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    consts::RANGE_PROOF_CHUNK_SIZE,
    withdraw::WithdrawCircuit,
};
use shielder_relayer::{QuoteFeeResponse, RelayQuery};
use shielder_rust_sdk::{
    account::call_data::{MerkleProof, WithdrawCallType, WithdrawExtra},
    alloy_primitives::U256,
    contract::merkle_path::get_current_merkle_path,
    version::contract_version,
};

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

async fn prepare_relay_queries<'actor>(
    config: &Config,
    actors: Vec<Actor>,
) -> Result<Vec<(Actor, RelayQuery)>> {
    let (params, pk) = proving_keys::<WithdrawCircuit<_, RANGE_PROOF_CHUNK_SIZE>>();
    let mut result = Vec::new();

    let quoted_fees = reqwest::Client::new()
        .get(config.relayer_url.clone() + "/quote_fee")
        .send()
        .await?
        .json::<QuoteFeeResponse>()
        .await?;

    let relayer_fee =
        quoted_fees.base_fee.parse::<U256>()? + quoted_fees.relay_fee.parse::<U256>()?;

    println!("⏳ Preparing relay queries for actors...");
    for actor in actors {
        let query = prepare_relay_query(config, &actor, &params, &pk, relayer_fee).await?;
        result.push((actor, query));
    }
    Ok(result)
}

async fn prepare_relay_query(
    config: &Config,
    actor: &Actor,
    params: &Params,
    pk: &ProvingKey,
    relayer_fee: U256,
) -> Result<RelayQuery> {
    let (merkle_root, merkle_path) =
        get_current_merkle_path(U256::from(actor.id), &actor.shielder_user).await?;
    let to = config.master_seed.address();

    let calldata = actor.account.prepare_call::<WithdrawCallType>(
        params,
        pk,
        U256::from(WITHDRAW_AMOUNT),
        &WithdrawExtra {
            merkle_proof: MerkleProof {
                root: merkle_root,
                path: merkle_path,
            },
            to,
            relayer_address: config.relayer_address,
            relayer_fee,
            contract_version: contract_version(),
        },
    );

    let query = RelayQuery {
        expected_contract_version: contract_version().to_bytes(),
        id_hiding: calldata.idHiding,
        amount: U256::from(WITHDRAW_AMOUNT),
        withdraw_address: to,
        merkle_root,
        nullifier_hash: calldata.oldNullifierHash,
        new_note: calldata.newNote,
        proof: calldata.proof,
    };
    println!("  ✅ Prepared relay query for actor {}", actor.id);
    Ok(query)
}
