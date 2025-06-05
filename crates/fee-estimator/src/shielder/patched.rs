use alloy_primitives::{BlockHash, Bytes, TxHash, U256};
use alloy_provider::{
    network::{primitives::BlockTransactionsKind, AnyNetwork},
    Provider,
};
use alloy_rpc_types::{Filter, TransactionTrait};
use alloy_sol_types::{SolCall, SolEvent};
use alloy_transport::BoxTransport;
use anyhow::Result;
use shielder_contract::{
    recovery::get_block_of_nullifier_spending,
    ShielderContract::{
        depositERC20Call, depositNativeCall, newAccountERC20Call, newAccountNativeCall, Deposit,
        NewAccount, ShielderContractEvents,
    },
    ShielderContractError, ShielderUser,
};

type ContractResult<T> = Result<T, ShielderContractError>;

pub async fn get_shielder_action(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
    shielder_user: &ShielderUser,
    nullifier: U256,
) -> ContractResult<Option<(TxHash, ShielderContractEvents)>> {
    // 1. Find the block number where the nullifier was spent, if any
    let Some(block_number) = get_block_of_nullifier_spending(shielder_user, nullifier).await?
    else {
        return Ok(None);
    };

    // 2. Fetch the block from the provider
    let block = provider
        .get_block_by_number(block_number.into(), BlockTransactionsKind::Full)
        .await
        .map_err(ShielderContractError::ProviderError)?
        .ok_or(ShielderContractError::Other("Block not found".into()))?;

    // 3. Iterate over the transactions in the block and find the one that matches the nullifier
    let txs = block
        .transactions
        .as_transactions()
        .expect("We asked for full transactions");
    for tx in txs {
        let tx_hash = tx.info().hash.expect("Transaction hash expected");
        let block_hash = tx.block_hash.expect("Block hash expected");
        let tx_data = tx.input();
        match check_if_tx_is_shielder_action(provider, tx_hash, tx_data, block_hash).await? {
            Some((event, spent_nullifier)) if spent_nullifier == nullifier => {
                return Ok(Some((
                    tx.info().hash.expect("Transaction hash expected"),
                    event,
                )));
            }
            _ => continue,
        }
    }
    Ok(None)
}

/// Try decoding the transaction data to determine the Shielder action type. Then, if successful,
/// get the corresponding event and used nullifier from the blockchain logs.
pub async fn check_if_tx_is_shielder_action(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
    tx_hash: TxHash,
    tx_data: &Bytes,
    block_hash: BlockHash,
) -> Result<Option<(ShielderContractEvents, U256)>, ShielderContractError> {
    if let Ok(call) = newAccountNativeCall::abi_decode(tx_data, true) {
        let event = get_event::<NewAccount>(provider, tx_hash, block_hash).await?;
        return Ok(Some((
            ShielderContractEvents::NewAccount(event),
            call.prenullifier,
        )));
    }

    if let Ok(call) = newAccountERC20Call::abi_decode(tx_data, true) {
        let event = get_event::<NewAccount>(provider, tx_hash, block_hash).await?;
        return Ok(Some((
            ShielderContractEvents::NewAccount(event),
            call.prenullifier,
        )));
    }

    if let Ok(call) = depositNativeCall::abi_decode(tx_data, true) {
        let event = get_event::<Deposit>(provider, tx_hash, block_hash).await?;
        return Ok(Some((
            ShielderContractEvents::Deposit(event),
            call.oldNullifierHash,
        )));
    }

    if let Ok(call) = depositERC20Call::abi_decode(tx_data, true) {
        let event = get_event::<Deposit>(provider, tx_hash, block_hash).await?;
        return Ok(Some((
            ShielderContractEvents::Deposit(event),
            call.oldNullifierHash,
        )));
    }

    Ok(None)
}

/// Look at the logs of `tx_hash` in `block_hash` and return the first event of type `Event`.
async fn get_event<Event: SolEvent>(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
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
