use alloc::vec::Vec;

use shielder_circuits::deposit::{DepositInstance, DepositProverKnowledge};
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use super::error::VerificationError;
use crate::utils::{vec_to_f, vec_to_path};

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Object))]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[derive(Clone, Debug)]
pub struct DepositCircuit(super::DepositCircuit);

#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
impl DepositCircuit {
    #[cfg_attr(feature = "build-uniffi", uniffi::constructor)]
    #[cfg_attr(feature = "build-wasm", wasm_bindgen(constructor))]
    pub fn new_pronto() -> Self {
        DepositCircuit(super::DepositCircuit::new_pronto())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn prove(
        &self,
        id: Vec<u8>,
        nonce: Vec<u8>,
        nullifier_old: Vec<u8>,
        trapdoor_old: Vec<u8>,
        account_balance_old: Vec<u8>,
        token_address: Vec<u8>,
        path: Vec<u8>,
        value: Vec<u8>,
        nullifier_new: Vec<u8>,
        trapdoor_new: Vec<u8>,
        mac_salt: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &DepositProverKnowledge {
                id: vec_to_f(id),
                nonce: vec_to_f(nonce),
                nullifier_old: vec_to_f(nullifier_old),
                trapdoor_old: vec_to_f(trapdoor_old),
                account_old_balance: vec_to_f(account_balance_old),
                token_address: vec_to_f(token_address),
                path: vec_to_path(path),
                deposit_value: vec_to_f(value),
                nullifier_new: vec_to_f(nullifier_new),
                trapdoor_new: vec_to_f(trapdoor_new),
                mac_salt: vec_to_f(mac_salt),
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
        token_address: Vec<u8>,
        mac_salt: Vec<u8>,
        mac_commitment: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: DepositInstance| {
            let value = match input {
                DepositInstance::IdHiding => &id_hiding,
                DepositInstance::MerkleRoot => &merkle_root,
                DepositInstance::HashedOldNullifier => &h_nullifier_old,
                DepositInstance::HashedNewNote => &h_note_new,
                DepositInstance::DepositValue => &value,
                DepositInstance::TokenAddress => &token_address,
                DepositInstance::MacSalt => &mac_salt,
                DepositInstance::MacCommitment => &mac_commitment,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(Into::into)
    }
}
