use std::{
    cmp::{max, min},
    path::PathBuf,
};

use alloy_primitives::Address;
use alloy_provider::Provider;
use alloy_rpc_types::{Filter, Log};
use alloy_sol_types::SolEvent;
use log::{debug, info, trace};
use rusqlite::Connection;
use shielder_circuits::Fr;
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{Deposit, NewAccount, ShielderContractEvents, Withdraw},
};
use type_conversions::u256_to_field;

use crate::{
    db::{self, Event},
    recoverable_error::MaybeRecoverableError,
};

const CHECKPOINT_TABLE_NAME: &str = "last_events_block";

pub async fn run(
    rpc_url: &str,
    shielder_address: &Address,
    from_block: u64,
    batch_size: usize,
    db_path: &PathBuf,
) -> Result<(), MaybeRecoverableError> {
    let connection = db::init(db_path)?;
    let provider = create_simple_provider(rpc_url).await?;
    let current_height = provider.get_block_number().await?;
    let base_filter = Filter::new().address(*shielder_address);

    db::create_events_table(&connection)?;
    db::create_checkpoint_table(&connection, CHECKPOINT_TABLE_NAME)?;

    let last_seen_block = db::query_checkpoint(&connection, CHECKPOINT_TABLE_NAME)?;
    info!("last seen block: {last_seen_block}");

    for block_number in (max(from_block, last_seen_block)..=current_height).step_by(batch_size) {
        let last_batch_block = min(block_number + batch_size as u64 - 1, current_height);
        let filter = base_filter
            .clone()
            .from_block(block_number)
            .to_block(last_batch_block);

        let raw_logs = provider.get_logs(&filter).await?;

        debug!(
            "Found {} raw Shielder event logs in the block range {block_number} : {last_batch_block}",
            raw_logs.len()
        );

        process_logs(raw_logs, &connection)?;
        trace!("Updating last seen block: {last_batch_block}");
        db::update_checkpoint(&connection, CHECKPOINT_TABLE_NAME, last_batch_block)?;
    }

    Ok(())
}

fn process_logs(logs: Vec<Log>, connection: &Connection) -> Result<(), MaybeRecoverableError> {
    for log in logs {
        let tx_hash = log
            .transaction_hash
            .ok_or(MaybeRecoverableError::MissingData)?
            .0;
        let block_number = log.block_number.ok_or(MaybeRecoverableError::MissingData)?;

        match log.topic0() {
            Some(&NewAccount::SIGNATURE_HASH) => {
                persist_event(
                    connection,
                    ShielderContractEvents::NewAccount(NewAccount::decode_log_data(
                        log.data(),
                        true,
                    )?),
                    &tx_hash,
                    block_number,
                )?;
            }
            Some(&Deposit::SIGNATURE_HASH) => {
                persist_event(
                    connection,
                    ShielderContractEvents::Deposit(Deposit::decode_log_data(log.data(), true)?),
                    &tx_hash,
                    block_number,
                )?;
            }
            Some(&Withdraw::SIGNATURE_HASH) => {
                persist_event(
                    connection,
                    ShielderContractEvents::Withdraw(Withdraw::decode_log_data(log.data(), true)?),
                    &tx_hash,
                    block_number,
                )?;
            }
            _ => debug!("Skipping log with an unknown topic {:?}", log.topic0()),
        };
    }

    Ok(())
}

fn persist_event(
    connection: &Connection,
    event: ShielderContractEvents,
    tx_hash: &[u8; 32],
    block_number: u64,
) -> Result<(), rusqlite::Error> {
    let (mac_salt, mac_commitment) = match event {
        ShielderContractEvents::NewAccount(NewAccount {
            macSalt,
            macCommitment,
            ..
        })
        | ShielderContractEvents::Deposit(Deposit {
            macSalt,
            macCommitment,
            ..
        })
        | ShielderContractEvents::Withdraw(Withdraw {
            macSalt,
            macCommitment,
            ..
        }) => (macSalt, macCommitment),
    };

    let mac_salt = u256_to_field::<Fr>(mac_salt).to_bytes();
    let mac_commitment = u256_to_field::<Fr>(mac_commitment).to_bytes();

    let event = Event {
        tx_hash: tx_hash.to_vec(),
        block_number,
        mac_salt: mac_salt.to_vec(),
        mac_commitment: mac_commitment.to_vec(),
        viewing_key: None,
    };

    info!("Persisting event {event:?}");
    db::upsert_event(connection, event)
}
