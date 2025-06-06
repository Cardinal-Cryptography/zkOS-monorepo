use alloy_network::{primitives::BlockTransactionsKind, AnyNetwork, TransactionResponse};
use alloy_primitives::{BlockHash, BlockNumber, Bytes, TxHash, U256};
use alloy_provider::Provider;
use alloy_rpc_types::TransactionTrait;
use alloy_sol_types::SolCall;
use alloy_transport::BoxTransport;

use crate::{
    call_type::DryRun,
    events::get_event,
    ContractResult,
    ShielderContract::{
        depositERC20Call, depositNativeCall, newAccountERC20Call, newAccountNativeCall,
        withdrawERC20Call, withdrawNativeCall, Deposit, NewAccount, ShielderContractEvents,
        Withdraw,
    },
    ShielderContractError, ShielderUser,
};

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
        let tx_hash = tx.info().hash.ok_or(ShielderContractError::Other(
            "Transaction hash not found".into(),
        ))?;
        let block_hash = tx
            .block_hash
            .ok_or(ShielderContractError::Other("Block hash not found".into()))?;
        let tx_data = tx.input();
        match check_if_tx_is_shielder_action(provider, tx_hash, tx_data, block_hash).await? {
            Some((event, spent_nullifier)) if spent_nullifier == nullifier => {
                return Ok(Some((tx.tx_hash(), event)));
            }
            _ => continue,
        }
    }
    Ok(None)
}

/// Get the block number where the nullifier was spent, if any.
pub async fn get_block_of_nullifier_spending(
    shielder_user: &ShielderUser,
    nullifier: U256,
) -> ContractResult<Option<BlockNumber>> {
    // 1. Fetch the block number from the contract
    let mut block_number = shielder_user.nullifiers::<DryRun>(nullifier).await?;

    // 2. Check if the nullifier has been used
    if block_number == U256::ZERO {
        return Ok(None);
    };

    // 3. Remove the offset for null detection
    block_number -= U256::from(1);

    // 4. Ensure the block number is valid (serious problem with contract if not)
    if block_number >= U256::from(BlockNumber::MAX) {
        return Err(ShielderContractError::Other(format!(
            "Block number too large: {block_number}"
        )));
    }

    // 5. Convert to a BlockNumber
    Ok(Some(block_number.into_limbs()[0]))
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

    if let Ok(call) = withdrawNativeCall::abi_decode(tx_data, true) {
        let event = get_event::<Withdraw>(provider, tx_hash, block_hash).await?;
        return Ok(Some((
            ShielderContractEvents::Withdraw(event),
            call.oldNullifierHash,
        )));
    }

    if let Ok(call) = withdrawERC20Call::abi_decode(tx_data, true) {
        let event = get_event::<Withdraw>(provider, tx_hash, block_hash).await?;
        return Ok(Some((
            ShielderContractEvents::Withdraw(event),
            call.oldNullifierHash,
        )));
    }

    Ok(None)
}
