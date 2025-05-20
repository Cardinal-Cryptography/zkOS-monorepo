use alloy_primitives::{BlockNumber, U256};
use alloy_provider::{
    network::{primitives::BlockTransactionsKind, TransactionResponse},
    Provider,
};
use alloy_rpc_types_eth::{Transaction, TransactionTrait};
use alloy_sol_types::SolCall;
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_contract::{
    call_type::DryRun,
    events::get_event,
    ShielderContract::{
        depositERC20Call, depositNativeCall, newAccountERC20Call, newAccountNativeCall,
        withdrawERC20Call, withdrawNativeCall, Deposit, NewAccount, ShielderContractEvents,
        Withdraw,
    },
    ShielderContractError, ShielderUser,
};
use type_conversions::{field_to_u256, u256_to_field};

use crate::{ShielderAccount, ShielderAction};

impl ShielderAccount {
    pub async fn recover(
        &mut self,
        shielder_user: &ShielderUser,
        provider: &impl Provider,
    ) -> Result<(), ShielderContractError> {
        loop {
            // Calculate the expected nullifier hash
            let expected_nullifier = self.previous_nullifier();
            let expected_nullifier_hash = field_to_u256(hash(&[u256_to_field(expected_nullifier)]));

            // Check if the nullifier hash has already been registered in the contract
            let mut block_number = shielder_user
                .nullifiers::<DryRun>(expected_nullifier_hash)
                .await?;

            // Recovery done
            if block_number == U256::ZERO {
                return Ok(());
            };

            block_number -= U256::from(1); // remove the offset for null detection
            if block_number >= U256::from(BlockNumber::MAX) {
                return Err(ShielderContractError::Other(format!(
                    "Block number too large: {block_number}"
                )));
            }
            let block_number = block_number.into_limbs()[0];

            let action = self
                .find_shielder_transaction(&provider, block_number)
                .await?;
            self.register_action(action);
        }
    }

    async fn find_shielder_transaction(
        &self,
        provider: &impl Provider,
        block_number: BlockNumber,
    ) -> Result<ShielderAction, ShielderContractError> {
        let block = provider
            .get_block_by_number(block_number.into(), BlockTransactionsKind::Hashes)
            .await
            .map_err(ShielderContractError::ProviderError)?
            .ok_or(ShielderContractError::Other("Block not found".into()))?;

        for tx_hash in block.transactions.as_hashes().expect("We have hashes") {
            let tx = match provider.get_transaction_by_hash(*tx_hash).await {
                Ok(Some(tx)) => tx,
                _ => continue,
            };

            let event = match try_get_shielder_event_for_tx(provider, &tx).await? {
                Some(event) => event,
                _ => continue,
            };

            event.check_version()?;
            let event_note = event.note();
            let action = ShielderAction::from((tx.tx_hash(), event));

            let mut hypothetical_account = self.clone();
            hypothetical_account.register_action(action.clone());
            let expected_note = hypothetical_account
                .note(action.token())
                .expect("We have just made an action");

            if expected_note == event_note {
                return Ok(action);
            }
        }
        Err(ShielderContractError::Other("Transaction not found".into()))
    }
}

/// Try decoding the transaction data to determine the Shielder action type. Then, if successful,
/// get the corresponding event from the blockchain logs.
pub async fn try_get_shielder_event_for_tx(
    provider: &impl Provider,
    tx: &Transaction,
) -> Result<Option<ShielderContractEvents>, ShielderContractError> {
    let tx_data = tx.input();
    let block_hash = tx
        .block_hash()
        .ok_or(ShielderContractError::EventNotFound)?;
    let maybe_action = if newAccountNativeCall::abi_decode(tx_data, true).is_ok()
        || newAccountERC20Call::abi_decode(tx_data, true).is_ok()
    {
        let event = get_event::<NewAccount>(provider, tx.tx_hash(), block_hash).await?;
        Some(ShielderContractEvents::NewAccount(event))
    } else if depositNativeCall::abi_decode(tx_data, true).is_ok()
        || depositERC20Call::abi_decode(tx_data, true).is_ok()
    {
        let event = get_event::<Deposit>(provider, tx.tx_hash(), block_hash).await?;
        Some(ShielderContractEvents::Deposit(event))
    } else if withdrawNativeCall::abi_decode(tx_data, true).is_ok()
        || withdrawERC20Call::abi_decode(tx_data, true).is_ok()
    {
        let event = get_event::<Withdraw>(provider, tx.tx_hash(), block_hash).await?;
        Some(ShielderContractEvents::Withdraw(event))
    } else {
        None
    };
    Ok(maybe_action)
}
