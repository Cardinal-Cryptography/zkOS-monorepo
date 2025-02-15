use alloc::vec::Vec;

use shielder_circuits::withdraw::{WithdrawInstance, WithdrawProverKnowledge};
use shielder_setup::native_token::NATIVE_TOKEN_ADDRESS;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use super::error::VerificationError;
use crate::utils::{vec_to_f, vec_to_path};

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Object))]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[derive(Clone, Debug)]
pub struct WithdrawCircuit(super::WithdrawCircuit);

#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
impl WithdrawCircuit {
    #[cfg_attr(feature = "build-uniffi", uniffi::constructor)]
    #[cfg_attr(feature = "build-wasm", wasm_bindgen(constructor))]
    pub fn new_pronto() -> Self {
        WithdrawCircuit(super::WithdrawCircuit::new_pronto())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn prove(
        &self,
        id: Vec<u8>,
        nonce: Vec<u8>,
        nullifier_old: Vec<u8>,
        trapdoor_old: Vec<u8>,
        account_balance_old: Vec<u8>,
        path: Vec<u8>,
        value: Vec<u8>,
        nullifier_new: Vec<u8>,
        trapdoor_new: Vec<u8>,
        commitment: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &WithdrawProverKnowledge {
                id: vec_to_f(id),
                nonce: vec_to_f(nonce),
                nullifier_old: vec_to_f(nullifier_old),
                trapdoor_old: vec_to_f(trapdoor_old),
                account_old_balance: vec_to_f(account_balance_old),
                token_address: NATIVE_TOKEN_ADDRESS,
                path: vec_to_path(path),
                withdrawal_value: vec_to_f(value),
                nullifier_new: vec_to_f(nullifier_new),
                trapdoor_new: vec_to_f(trapdoor_new),
                commitment: vec_to_f(commitment),
            },
            &mut rand::thread_rng(),
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn verify(
        &self,
        id_hiding: Vec<u8>,
        merkle_root: Vec<u8>,
        h_nullifier_old: Vec<u8>,
        h_note_new: Vec<u8>,
        value: Vec<u8>,
        proof: Vec<u8>,
        commitment: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: WithdrawInstance| {
            let value = match input {
                WithdrawInstance::IdHiding => &id_hiding,
                WithdrawInstance::MerkleRoot => &merkle_root,
                WithdrawInstance::HashedOldNullifier => &h_nullifier_old,
                WithdrawInstance::HashedNewNote => &h_note_new,
                WithdrawInstance::WithdrawalValue => &value,
                WithdrawInstance::Commitment => &commitment,
                WithdrawInstance::TokenAddress => &NATIVE_TOKEN_ADDRESS.to_bytes().to_vec(),
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(Into::into)
    }
}
