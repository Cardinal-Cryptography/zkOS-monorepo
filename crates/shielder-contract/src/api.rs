use alloy_primitives::{Address, U256};
use alloy_provider::Provider;
use alloy_sol_types::SolCall;

#[cfg(feature = "erc20")]
use crate::erc20::ERC20::approveCall;
use crate::{
    call_type::CallType,
    connection::{Connection, ConnectionPolicy, NoProvider},
    ContractResult,
    ShielderContract::{
        anonymityRevokerPubkeyCall, depositERC20Call, depositNativeCall, getMerklePathCall,
        newAccountERC20Call, newAccountNativeCall, nullifiersCall, withdrawERC20Call,
        withdrawNativeCall,
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
    pub async fn new_account_native<C: CallType<newAccountNativeCall>>(
        &self,
        call: newAccountNativeCall,
        value: U256,
    ) -> ContractResult<C::Result> {
        self.connection.call_with_value::<C, _>(call, value).await
    }

    /// Create new account with ERC20 token.
    pub async fn new_account_erc20<C: CallType<newAccountERC20Call>>(
        &self,
        call: newAccountERC20Call,
    ) -> ContractResult<C::Result> {
        self.connection.call::<C, _>(call).await
    }

    /// Deposit native currency into the contract.
    pub async fn deposit_native<C: CallType<depositNativeCall>>(
        &self,
        call: depositNativeCall,
        value: U256,
    ) -> ContractResult<C::Result> {
        self.connection.call_with_value::<C, _>(call, value).await
    }

    /// Deposit ERC20 token into the contract.
    pub async fn deposit_erc20<C: CallType<depositERC20Call>>(
        &self,
        call: depositERC20Call,
    ) -> ContractResult<C::Result> {
        self.connection.call::<C, _>(call).await
    }

    /// Withdraw native currency from the contract.
    pub async fn withdraw_native<C: CallType<withdrawNativeCall>>(
        &self,
        call: withdrawNativeCall,
    ) -> ContractResult<C::Result> {
        self.connection.call::<C, _>(call).await
    }

    /// Withdraw ERC20 token from the contract.
    pub async fn withdraw_erc20<C: CallType<withdrawERC20Call>>(
        &self,
        call: withdrawERC20Call,
        pocket_money: U256,
    ) -> ContractResult<C::Result> {
        self.connection
            .call_with_value::<C, _>(call, pocket_money)
            .await
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

    pub async fn anonymity_revoker_pubkey<C: CallType<anonymityRevokerPubkeyCall>>(
        &self,
    ) -> ContractResult<C::Result> {
        self.connection
            .call::<C, _>(anonymityRevokerPubkeyCall::new(()))
            .await
    }

    #[cfg(feature = "erc20")]
    pub async fn approve_erc20<C: CallType<approveCall>>(
        &self,
        contract_address: Address,
        spender: Address,
        amount: U256,
    ) -> ContractResult<C::Result> {
        self.connection
            .call::<C, _>(approveCall { spender, amount })
            .await
    }
}
