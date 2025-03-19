use std::cmp::min;

use alloy_json_rpc::{RpcError, RpcParam, RpcReturn};
use alloy_primitives::Address;
use alloy_provider::Provider;
use alloy_rpc_types::{BlockNumberOrTag, BlockTransactionsKind, Filter, Log, TransactionTrait};
use alloy_sol_types::SolCall;
use alloy_transport::TransportErrorKind;
use hex::FromHexError;
use log::{debug, info, trace};
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{
        newAccountERC20Call, newAccountNativeCall, ShielderContractCalls::newAccountNative,
    },
    ShielderContractError,
};
use thiserror::Error;

const BATCH_SIZE: usize = 10_000;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum RevokeError {
    #[error("Error while interacting with the Shielder contract")]
    Contract(#[from] ShielderContractError),

    #[error("RPC error")]
    Rpc(#[from] RpcError<TransportErrorKind>),

    #[error("Hex decoding error")]
    HexError(#[from] FromHexError),
}

// TODO input: tx hash
// TODO: build DB view of history
// TODO : two step reveal
pub async fn run(rpc_url: &str, shielder_address: Address) -> Result<(), RevokeError> {
    // 1) TODO: go back in history and collect ALL viewing keys
    //       - look for new_account txs
    //       - read c1,c2 and decrypt it => k (viewing key)
    // read mac_commitmet = h(k, r) and r = mac_salt from the tx
    // publish k

    // 2) given k find all the matching txs
    //    - look if mac matches: mac_commitmet = h(k, r) and r = mac_salt from the tx

    let provider = create_simple_provider(rpc_url).await?;
    let last_block_number = provider.get_block_number().await?;

    // let logs_filter = Filter::new().address(shielder_address);

    // for block_number in (0..=last_block_number).step_by(BATCH_SIZE) {
    //     let last_block_in_batch = min(block_number + BATCH_SIZE as u64 - 1, last_block_number);

    //     let filter = logs_filter
    //         .clone()
    //         .from_block(block_number)
    //         .to_block(last_block_in_batch);

    //     // provider.get_block_by_number();

    //     let all_logs = provider.get_logs(&filter).await?;

    //     info!(
    //         "Found {} contract event logs in block range {block_number}-{last_block_in_batch}",
    //         all_logs.len()
    //     );

    //     debug!("Event logs {:?}", &all_logs);

    //     // let filtered_logs = filter_logs(all_logs);
    // }

    for block_number in 0..=last_block_number {
        if let Some(block) = provider
            .get_block_by_number(
                BlockNumberOrTag::Number(block_number),
                BlockTransactionsKind::Full,
            )
            .await?
        {
            if let Some(txs) = block.transactions.as_transactions() {
                for tx in txs {
                    if let Ok(tx) = newAccountNativeCall::abi_decode(tx.input(), false) {
                        debug!("Decoded newAccountNative transaction {tx:?}");
                    }

                    if let Ok(tx) = newAccountERC20Call::abi_decode(tx.input(), false) {
                        debug!("Decoded newAccountERC20 transaction {tx:?}");
                    }
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn playground() {
        assert!(false);
    }
}
