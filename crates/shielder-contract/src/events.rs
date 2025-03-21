use alloy_primitives::{BlockHash, TxHash};
use alloy_provider::Provider;
use alloy_rpc_types::Filter;
use alloy_sol_types::SolEvent;

use crate::{ContractResult, ShielderContractError};

/// Look at the logs of `tx_hash` in `block_hash` and return the first event of type `Event`.
pub async fn get_event<Event: SolEvent>(
    provider: &impl Provider,
    tx_hash: TxHash,
    block_hash: BlockHash,
) -> ContractResult<Event> {
    let filter = Filter::new().at_block_hash(block_hash);
    provider
        .get_logs(&filter)
        .await
        .map_err(ShielderContractError::ProviderError)?
        .iter()
        .filter_map(|log| {
            if log.transaction_hash != Some(tx_hash) {
                return None;
            }
            let log_data = log.data().clone();
            Event::decode_log_data(&log_data, true).ok()
        })
        .next()
        .ok_or(ShielderContractError::EventNotFound)
}
