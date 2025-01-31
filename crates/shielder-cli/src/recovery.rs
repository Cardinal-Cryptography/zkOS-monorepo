use alloy_primitives::{BlockHash, BlockNumber, U256};
use alloy_provider::{
    network::{primitives::BlockTransactionsKind, TransactionResponse},
    Provider,
};
use alloy_rpc_types_eth::{Transaction, TransactionTrait};
use alloy_sol_types::SolCall;
use anyhow::{anyhow, bail, Result};
use shielder_account::{ShielderAccount, ShielderAction};
use shielder_circuits::{poseidon::off_circuit::hash, F};
use shielder_contract::{
    call_type::DryRun,
    events::get_event,
    providers::create_simple_provider,
    ShielderContract::{
        depositTokenCall, newAccountTokenCall, withdrawTokenCall, Deposit, NewAccount,
        ShielderContractEvents, Withdraw,
    },
};
use tracing::{error, info};
use type_conversions::{field_to_u256, u256_to_field};

use crate::app_state::AppState;

pub async fn recover_state(app_state: &mut AppState) -> Result<()> {
    let shielder_user = app_state.create_shielder_user();
    let AppState {
        account,
        node_rpc_url,
        ..
    } = app_state;

    let mut recovering_account = account.clone();

    let provider = create_simple_provider(node_rpc_url).await?;

    loop {
        info!("Recovering state for nonce {}", recovering_account.nonce);

        // Calculate the expected nullifier hash
        let expected_nullifier = recovering_account.previous_nullifier();
        let expected_nullifier_hash =
            field_to_u256(hash::<F, 1>(&[u256_to_field(expected_nullifier)]));

        // Check if the nullifier hash has already been registered in the contract.
        let mut block_number = shielder_user
            .nullifiers::<DryRun>(expected_nullifier_hash)
            .await?;
        if block_number == U256::ZERO {
            info!("Nullifier hash {expected_nullifier_hash} not found, recovering state completed");
            break;
        };
        block_number -= U256::from(1); // remove the offset for null detection
        if block_number >= U256::from(BlockNumber::MAX) {
            let msg = format!("Block number too large: {block_number}");
            error!(msg);
            bail!(msg);
        }
        let block_number = block_number.into_limbs()[0];
        info!("Nullifier hash {expected_nullifier_hash} found in block {block_number}");

        // If yes, find the corresponding transaction.
        let action =
            find_shielder_transaction(&provider, block_number, &recovering_account).await?;

        // Apply the action to the account.
        recovering_account.register_action(action);
    }

    *account = recovering_account;

    Ok(())
}

async fn find_shielder_transaction(
    provider: &impl Provider,
    block_number: BlockNumber,
    account: &ShielderAccount,
) -> Result<ShielderAction> {
    let block_number = block_number.into();
    let block = provider
        .get_block_by_number(block_number, BlockTransactionsKind::Hashes)
        .await?
        .ok_or(anyhow!("Block not found"))?;

    for tx_hash in block.transactions.as_hashes().expect("We have hashes") {
        let tx = match provider.get_transaction_by_hash(*tx_hash).await {
            Ok(Some(tx)) => tx,
            _ => continue,
        };

        let event = match try_get_shielder_event_for_tx(provider, &tx, block.header.hash).await? {
            Some(event) => event,
            _ => continue,
        };

        event.check_version().map_err(|_| anyhow!("Bad version"))?;
        let event_note = event.note();
        let action = ShielderAction::from((tx.tx_hash(), event));

        let mut hypothetical_account = account.clone();
        hypothetical_account.register_action(action.clone());
        let expected_note = hypothetical_account
            .note()
            .expect("We have just made an action");

        if expected_note == event_note {
            return Ok(action);
        }
    }
    bail!("No matching Shielder transaction found in block {block_number}")
}

async fn try_get_shielder_event_for_tx(
    provider: &impl Provider,
    tx: &Transaction,
    block_hash: BlockHash,
) -> Result<Option<ShielderContractEvents>> {
    let tx_data = tx.input();
    let maybe_action = if newAccountTokenCall::abi_decode(tx_data, true).is_ok() {
        let event = get_event::<NewAccount>(provider, tx.tx_hash(), block_hash).await?;
        Some(ShielderContractEvents::NewAccount(event))
    } else if depositTokenCall::abi_decode(tx_data, true).is_ok() {
        let event = get_event::<Deposit>(provider, tx.tx_hash(), block_hash).await?;
        Some(ShielderContractEvents::Deposit(event))
    } else if withdrawTokenCall::abi_decode(tx_data, true).is_ok() {
        let event = get_event::<Withdraw>(provider, tx.tx_hash(), block_hash).await?;
        Some(ShielderContractEvents::Withdraw(event))
    } else {
        None
    };
    Ok(maybe_action)
}
