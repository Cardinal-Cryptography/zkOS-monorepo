use alloy_signer_local::PrivateKeySigner;
use rand::{rngs::StdRng, SeedableRng};
use shielder_account::{call_data::NewAccountCallType, ShielderAccount};
use shielder_circuits::circuits::{Params, ProvingKey};
use shielder_contract::{
    alloy_primitives::{Address, U256},
    ConnectionPolicy,
    ShielderContract::newAccountTokenCall,
    ShielderUser,
};

pub struct Actor {
    pub id: u32,
    pub shielder_user: ShielderUser,
    pub account: ShielderAccount,
}

impl Actor {
    pub fn new(id: u32, rpc_url: String, shielder: Address) -> Self {
        let signer = PrivateKeySigner::random_with(&mut StdRng::from_seed(seed(id)));
        let shielder_user =
            ShielderUser::new(shielder, ConnectionPolicy::OnDemand { rpc_url, signer });
        let account = ShielderAccount::new(U256::from(id));
        Self {
            id,
            shielder_user,
            account,
        }
    }

    pub fn address(&self) -> Address {
        self.shielder_user.address()
    }

    pub fn prepare_new_account_call(
        &self,
        params: &Params,
        pk: &ProvingKey,
        amount: U256,
    ) -> newAccountTokenCall {
        self.account
            .prepare_call::<NewAccountCallType>(params, pk, amount, &())
    }
}

fn seed(id: u32) -> [u8; 32] {
    id.to_be_bytes()
        .into_iter()
        .cycle()
        .take(32)
        .collect::<Vec<_>>()
        .try_into()
        .unwrap()
}
