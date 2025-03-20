use std::{borrow::Cow, cmp::min};

use alloy_json_rpc::{RpcError, RpcParam, RpcReturn};
use alloy_primitives::Address;
use alloy_provider::Provider;
use alloy_rpc_types::{Filter, Log};
use alloy_sol_types::{Error as SolError, SolEvent};
use alloy_transport::TransportErrorKind;
use log::{debug, info};
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{Deposit, NewAccount, ShielderContractEvents, Withdraw},
    ShielderContractError,
};
use thiserror::Error;

const BATCH_SIZE: usize = 10_000;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum IndexEventsError {
    #[error("Error while interacting with the Shielder contract")]
    Contract(#[from] ShielderContractError),

    #[error("RPC error")]
    Rpc(#[from] RpcError<TransportErrorKind>),
}

pub async fn run(rpc_url: &str, shielder_address: Address) -> Result<(), IndexEventsError> {
    let provider = create_simple_provider(rpc_url).await?;
    let current_height = provider.get_block_number().await?;
    let base_filter = Filter::new().address(shielder_address);

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

        let filtered_logs = filter_logs(raw_logs);

        info!(
            "Found {} filtered Shielder event logs in the block range {block_number} : {last_batch_block}",
            filtered_logs.len()
        );

        // TODO persist
        for event in filtered_logs {
            println!("{event:?}");
        }
    }

    Ok(())
}

fn filter_logs(logs: Vec<Log>) -> Vec<ShielderContractEvents> {
    logs.into_iter()
        .filter_map(|event| {
            let shielder_event = match *event.topic0()? {
                NewAccount::SIGNATURE_HASH => NewAccount::decode_log_data(event.data(), true)
                    .map(ShielderContractEvents::NewAccount),

                Deposit::SIGNATURE_HASH => Deposit::decode_log_data(event.data(), true)
                    .map(ShielderContractEvents::Deposit),

                Withdraw::SIGNATURE_HASH => Withdraw::decode_log_data(event.data(), true)
                    .map(ShielderContractEvents::Withdraw),

                _ => Err(SolError::Other(Cow::Borrowed("should not get here"))),
            }
            .ok()?;

            Some(shielder_event)
        })
        .collect()
}
