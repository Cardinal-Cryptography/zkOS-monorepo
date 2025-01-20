use std::marker::PhantomData;

use alloy_contract::CallBuilder;
use alloy_primitives::{BlockHash, TxHash};
use alloy_provider::Provider;
use alloy_transport::Transport;

use crate::{ContractResult, ShielderContractCall, ShielderContractError};

/// Submit the transaction to the network and wait for the block inclusion.
pub struct Call;
/// Submit the transaction to the network.
pub struct Submit;
/// Dry-run the transaction.
pub struct DryRun;

pub trait CallType<C: ShielderContractCall> {
    type Result: Send + Sync;

    fn action<T: Transport + Clone, P: Provider<T>>(
        call_builder: CallBuilder<T, P, PhantomData<C>>,
    ) -> impl std::future::Future<Output = ContractResult<Self::Result>> + Send;
}

impl<C: ShielderContractCall> CallType<C> for Call {
    type Result = (TxHash, BlockHash);

    async fn action<T: Transport + Clone, P: Provider<T>>(
        call_builder: CallBuilder<T, P, PhantomData<C>>,
    ) -> ContractResult<Self::Result> {
        call_builder
            .send()
            .await?
            .get_receipt()
            .await
            .map_err(|e| {
                eprintln!("Couldn't track the transaction: {e:?}");
                ShielderContractError::WatchError
            })
            .map(|receipt| {
                (
                    receipt.transaction_hash,
                    receipt.block_hash.expect("Block hash is missing"),
                )
            })
    }
}

impl<C: ShielderContractCall> CallType<C> for Submit {
    type Result = TxHash;

    async fn action<T: Transport + Clone, P: Provider<T>>(
        call_builder: CallBuilder<T, P, PhantomData<C>>,
    ) -> ContractResult<Self::Result> {
        Ok(*call_builder.send().await?.tx_hash())
    }
}

impl<C: ShielderContractCall + Unpin> CallType<C> for DryRun {
    type Result = C::UnwrappedResult;

    async fn action<T: Transport + Clone, P: Provider<T>>(
        call_builder: CallBuilder<T, P, PhantomData<C>>,
    ) -> ContractResult<Self::Result> {
        Ok(call_builder.call().await.map(C::unwrap_result)?)
    }
}
