use alloc::vec::Vec;

use shielder_circuits_v0_1_0::deposit::{DepositInstance, DepositProverKnowledge};
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use super::error::VerificationError;
use crate::utils::{vec_to_f, vec_to_path, vec_to_token_list};

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Object))]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[derive(Clone, Debug)]
pub struct DepositCircuitV0_1_0(super::DepositCircuitV0_1_0);

#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
impl DepositCircuitV0_1_0 {
    #[cfg_attr(feature = "build-uniffi", uniffi::constructor)]
    #[cfg_attr(feature = "build-wasm", wasm_bindgen(constructor))]
    pub fn new_pronto() -> Self {
        DepositCircuitV0_1_0(super::DepositCircuitV0_1_0::new_pronto())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn prove(
        &self,
        id: Vec<u8>,
        nullifier_old: Vec<u8>,
        trapdoor_old: Vec<u8>,
        balances_old: Vec<u8>,
        path: Vec<u8>,
        nullifier_new: Vec<u8>,
        trapdoor_new: Vec<u8>,
        token_indicators: Vec<u8>,
        nonce: Vec<u8>,
        deposit_value: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &DepositProverKnowledge {
                id: vec_to_f(id),
                nullifier_old: vec_to_f(nullifier_old),
                trapdoor_old: vec_to_f(trapdoor_old),
                balances_old: vec_to_token_list(balances_old),

                path: vec_to_path(path),

                nullifier_new: vec_to_f(nullifier_new),
                trapdoor_new: vec_to_f(trapdoor_new),

                token_indicators: vec_to_token_list(token_indicators),

                nonce: vec_to_f(nonce),

                deposit_value: vec_to_f(deposit_value),
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
        deposit_value: Vec<u8>,
        token_index: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: DepositInstance| {
            let value = match input {
                DepositInstance::IdHiding => &id_hiding,
                DepositInstance::MerkleRoot => &merkle_root,
                DepositInstance::HashedOldNullifier => &h_nullifier_old,
                DepositInstance::HashedNewNote => &h_note_new,
                DepositInstance::DepositValue => &deposit_value,
                DepositInstance::TokenIndex => &token_index,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(Into::into)
    }
}
