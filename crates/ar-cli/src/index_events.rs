use std::{borrow::Cow, cmp::min, sync::Arc};

use alloy_json_rpc::{RpcError, RpcParam, RpcReturn};
use alloy_primitives::Address;
use alloy_provider::Provider;
use alloy_rpc_types::{Filter, Log};
use alloy_sol_types::{Error as SolError, SolEvent};
use alloy_transport::TransportErrorKind;
use log::{debug, info};
use rusqlite::{ffi::sqlite3_changegroup, Connection};
use shielder_circuits::Fr;
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{Deposit, NewAccount, ShielderContractEvents, Withdraw},
    ShielderContractError,
};
use thiserror::Error;
use type_conversions::u256_to_field;

use crate::db::{self, Event};

const BATCH_SIZE: usize = 10_000;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum IndexEventsError {
    #[error("Error while interacting with the Shielder contract")]
    Contract(#[from] ShielderContractError),

    #[error("RPC error")]
    Rpc(#[from] RpcError<TransportErrorKind>),

    #[error("Error while decoding event log")]
    EventLog(#[from] alloy_sol_types::Error),

    #[error("Event is missing some data")]
    MissingData,

    #[error("Error while persisting data")]
    Db(#[from] rusqlite::Error),
}

pub async fn run(
    rpc_url: &str,
    shielder_address: &Address,
    connection: Connection,
) -> Result<(), IndexEventsError> {
    let provider = create_simple_provider(rpc_url).await?;
    let current_height = provider.get_block_number().await?;
    let base_filter = Filter::new().address(*shielder_address);

    db::create_events_table(&connection)?;

    for block_number in (0..=current_height).step_by(BATCH_SIZE) {
        let last_batch_block = min(block_number + BATCH_SIZE as u64 - 1, current_height);
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
    }

    Ok(())
}

fn process_logs(logs: Vec<Log>, connection: &Connection) -> Result<(), IndexEventsError> {
    for log in logs {
        let tx_hash = log.transaction_hash.ok_or(IndexEventsError::MissingData)?.0;
        let block_number = log.block_number.ok_or(IndexEventsError::MissingData)?;

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

    info!("Done");

    Ok(())
}

fn persist_event(
    connection: &Connection,
    event: ShielderContractEvents,
    tx_hash: &[u8; 32],
    block_number: u64,
) -> Result<(), rusqlite::Error> {
    if let ShielderContractEvents::NewAccount(NewAccount {
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
    }) = event
    {
        let mac_salt = u256_to_field::<Fr>(macSalt).to_bytes();
        let mac_commitment = u256_to_field::<Fr>(macCommitment).to_bytes();

        let event = Event {
            tx_hash: tx_hash.to_vec(),
            block_number,
            mac_salt: mac_salt.to_vec(),
            mac_commitment: mac_commitment.to_vec(),
            viewing_key: None,
        };
        info!("Persisting event {event:?}");
        return db::upsert_event(connection, event);
    }

    Ok(())
}
