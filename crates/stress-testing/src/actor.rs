use alloy_signer_local::PrivateKeySigner;
use rand::{rngs::StdRng, Rng, SeedableRng};
use shielder_account::{
    call_data::{NewAccountCallExtra, NewAccountCallType},
    ShielderAccount, Token,
};
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    GrumpkinPointAffine,
};
use shielder_contract::{
    alloy_primitives::{Address, Bytes, U256},
    ConnectionPolicy,
    ShielderContract::newAccountNativeCall,
    ShielderUser,
};

pub struct Actor {
    pub id: u32,
    pub shielder_user: ShielderUser,
    pub account: ShielderAccount,
}

pub const ANONYMITY_REVOKER_PKEY: GrumpkinPointAffine<U256> = GrumpkinPointAffine {
    x: U256::from_limbs([1, 0, 0, 0]),
    y: U256::from_limbs([
        9457493854555940652,
        3253583849847263892,
        14921373847124204899,
        2,
    ]),
};

impl Actor {
    pub fn new(id: u32, rpc_url: String, shielder: Address) -> Self {
        let mut rng = StdRng::from_seed(seed(id));

        let signer = PrivateKeySigner::random_with(&mut rng);
        let shielder_user =
            ShielderUser::new(shielder, ConnectionPolicy::OnDemand { rpc_url, signer });

        let account = ShielderAccount::new(U256::from(rng.gen::<u64>()), Token::Native);

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
        protocol_fee: U256,
    ) -> newAccountNativeCall {
        self.account
            .prepare_call::<NewAccountCallType>(
                params,
                pk,
                Token::Native,
                amount,
                &NewAccountCallExtra {
                    anonymity_revoker_public_key: ANONYMITY_REVOKER_PKEY,
                    encryption_salt: U256::MAX,
                    mac_salt: U256::ZERO,
                    caller_address: self.shielder_user.address(),
                    protocol_fee,
                    memo: Bytes::from(vec![]),
                },
            )
            .try_into()
            .unwrap()
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
