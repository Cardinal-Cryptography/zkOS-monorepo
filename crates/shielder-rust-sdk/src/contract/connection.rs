use std::marker::PhantomData;

use alloy_contract::CallDecoder;
use alloy_network::Ethereum;
use alloy_primitives::{Address, U256};
use alloy_provider::{Provider, RootProvider};
use alloy_signer_local::PrivateKeySigner;
use alloy_transport::BoxTransport;

use crate::contract::{
    call_type::CallType, providers::create_provider_with_signer, ContractResult, ShielderContract,
    ShielderContractCall,
};

/// Placeholder for a provider in `ConnectionPolicy` / `Connection` and `ShielderUser` when only
/// `ConnectionPolicy::OnDemand` variant is used.
#[derive(Clone)]
pub enum NoProvider {}
impl Provider for NoProvider {
    fn root(&self) -> &RootProvider<BoxTransport, Ethereum> {
        unreachable!("NoProvider does not have a root provider")
    }
}

#[derive(Clone)]
pub enum ConnectionPolicy<Provider = NoProvider> {
    Keep {
        provider: Provider,
        caller_address: Address,
    },
    OnDemand {
        rpc_url: String,
        signer: PrivateKeySigner,
    },
}

impl<P: Provider> ConnectionPolicy<P> {
    pub fn caller_address(&self) -> Address {
        match self {
            ConnectionPolicy::Keep { caller_address, .. } => *caller_address,
            ConnectionPolicy::OnDemand { signer, .. } => signer.address(),
        }
    }
}

#[derive(Clone)]
pub struct Connection<Provider = NoProvider> {
    contract_address: Address,
    policy: ConnectionPolicy<Provider>,
}

// We require `Provider` to be `Clone`. Otherwise it is extremely hard to satisfy `Send` bounds in
// the async environment (a lot of "`Send` would have to be implemented for the type
// `&Provider`"-like errors happen).
impl<P: Provider + Clone> Connection<P> {
    pub fn new(contract_address: Address, policy: ConnectionPolicy<P>) -> Self {
        Self {
            contract_address,
            policy,
        }
    }

    pub fn caller_address(&self) -> Address {
        self.policy.caller_address()
    }

    pub async fn call<CT: CallType<Call>, Call: ShielderContractCall + Unpin>(
        &self,
        call: Call,
    ) -> ContractResult<CT::Result>
    where
        PhantomData<Call>: CallDecoder + Unpin,
    {
        self._call::<CT, _>(call, None).await
    }

    pub async fn call_with_value<CT: CallType<Call>, Call: ShielderContractCall + Unpin>(
        &self,
        call: Call,
        value: U256,
    ) -> ContractResult<CT::Result>
    where
        PhantomData<Call>: CallDecoder + Unpin,
    {
        self._call::<CT, _>(call, Some(value)).await
    }

    async fn _call<CT: CallType<Call>, Call: ShielderContractCall + Unpin>(
        &self,
        call: Call,
        value: Option<U256>,
    ) -> ContractResult<CT::Result>
    where
        PhantomData<Call>: CallDecoder + Unpin,
    {
        match &self.policy {
            ConnectionPolicy::Keep { provider, .. } => {
                self.call_with_resolved_provider::<CT, _>(call, value, provider.clone())
                    .await
            }
            ConnectionPolicy::OnDemand { rpc_url, signer } => {
                let provider = create_provider_with_signer(rpc_url, signer.clone()).await?;
                self.call_with_resolved_provider::<CT, _>(call, value, provider)
                    .await
            }
        }
    }

    async fn call_with_resolved_provider<CT: CallType<Call>, Call: ShielderContractCall + Unpin>(
        &self,
        call: Call,
        value: Option<U256>,
        provider: impl Provider,
    ) -> ContractResult<CT::Result>
    where
        PhantomData<Call>: CallDecoder + Unpin,
    {
        let contract = ShielderContract::new(self.contract_address, provider);
        let call_builder = contract
            .call_builder(&call)
            .from(self.caller_address())
            .value(value.unwrap_or_default());
        CT::action(call_builder).await
    }
}
