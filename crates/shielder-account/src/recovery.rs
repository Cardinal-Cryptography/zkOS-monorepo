use alloy_primitives::BlockHash;
use alloy_provider::{network::TransactionResponse, Provider};
use alloy_rpc_types_eth::{Transaction, TransactionTrait};
use alloy_sol_types::SolCall;
use shielder_contract::{
    events::get_event,
    ShielderContract::{
        depositERC20Call, depositNativeCall, newAccountERC20Call, newAccountNativeCall,
        withdrawERC20Call, withdrawNativeCall, Deposit, NewAccount, ShielderContractEvents,
        Withdraw,
    },
    ShielderContractError,
};

/// Try decoding the transaction data to determine the Shielder action type. Then, if successful,
/// get the corresponding event from the blockchain logs.
pub async fn try_get_shielder_event_for_tx(
    provider: &impl Provider,
    tx: &Transaction,
    block_hash: BlockHash,
) -> Result<Option<ShielderContractEvents>, ShielderContractError> {
    let tx_data = tx.input();
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
