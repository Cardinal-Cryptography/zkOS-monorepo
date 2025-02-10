use alloy_primitives::{Address, U256};
use alloy_provider::Provider;
use alloy_sol_types::SolCall;

use crate::{
    call_type::CallType,
    connection::{Connection, ConnectionPolicy, NoProvider},
    ContractResult,
    ShielderContract::{
        depositCall, getAnonimityRevokerPubkeyCall, getMerklePathCall, newAccountCall,
        nullifiersCall, withdrawCall,
    },
};

/// Standard user of the Shielder contract. Can deposit and withdraw funds from the contract, as
/// well as query the contract for information.
///
/// Essentially, this is a thin wrapper around the `Connection` struct that provides a more
/// user-friendly interface for interacting with the contract.
#[derive(Clone)]
pub struct ShielderUser<Provider = NoProvider> {
    connection: Connection<Provider>,
}

impl<P: Provider + Clone> ShielderUser<P> {
    /// Create a new `ShielderUser` instance.
    pub fn new(contract_address: Address, connection_policy: ConnectionPolicy<P>) -> Self {
        let connection = Connection::new(contract_address, connection_policy);
        Self { connection }
    }

    /// Get the address of the user.
    pub fn address(&self) -> Address {
        self.connection.caller_address()
    }

    /// Create new account.
    pub async fn create_new_account_native<C: CallType<newAccountCall>>(
        &self,
        call: newAccountCall,
        value: U256,
    ) -> ContractResult<C::Result> {
        self.connection.call_with_value::<C, _>(call, value).await
    }

    /// Deposit native currency into the contract.
    pub async fn deposit_native<C: CallType<depositCall>>(
        &self,
        call: depositCall,
        value: U256,
    ) -> ContractResult<C::Result> {
        self.connection.call_with_value::<C, _>(call, value).await
    }

    /// Withdraw native currency from the contract.
    pub async fn withdraw_native<C: CallType<withdrawCall>>(
        &self,
        call: withdrawCall,
    ) -> ContractResult<C::Result> {
        self.connection.call::<C, _>(call).await
    }

    /// Get the block number for the `nullifierHash`. `0` means that the nullifier hasn't been used
    /// yet.
    pub async fn nullifiers<C: CallType<nullifiersCall>>(
        &self,
        nullifier_hash: U256,
    ) -> ContractResult<C::Result> {
        self.connection
            .call::<C, _>(nullifiersCall {
                nullifierHash: nullifier_hash,
            })
            .await
    }

    /// Get the Merkle path for a given ID.
    pub async fn get_merkle_path<C: CallType<getMerklePathCall>>(
        &self,
        id: U256,
    ) -> ContractResult<C::Result> {
        self.connection
            .call::<C, _>(getMerklePathCall::new((id,)))
            .await
    }

    pub async fn get_anonimity_revoker_pubkey<C: CallType<getAnonimityRevokerPubkeyCall>>(
        &self,
    ) -> ContractResult<C::Result> {
        self.connection
            .call::<C, _>(getAnonimityRevokerPubkeyCall {})
            .await
    }
}
