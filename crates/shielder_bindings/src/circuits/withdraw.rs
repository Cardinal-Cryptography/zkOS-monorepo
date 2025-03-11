use alloc::vec::Vec;

use shielder_circuits::{
    withdraw::{WithdrawInstance, WithdrawProverKnowledge},
    Fr, PublicInputProvider,
};
use type_conversions::field_to_bytes;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use super::error::VerificationError;
use crate::utils::{vec_to_f, vec_to_path};

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Record))]
// `getter_with_clone` is required for `Vec<u8>` struct fields
#[cfg_attr(feature = "build-wasm", wasm_bindgen(getter_with_clone))]
#[derive(Clone, Debug, Default)]
pub struct WithdrawPubInputsBytes {
    pub merkle_root: Vec<u8>,
    pub h_nullifier_old: Vec<u8>,
    pub h_note_new: Vec<u8>,
    pub withdrawal_value: Vec<u8>,
    pub token_address: Vec<u8>,
    pub commitment: Vec<u8>,
    pub mac_salt: Vec<u8>,
    pub mac_commitment: Vec<u8>,
}

impl From<WithdrawProverKnowledge<Fr>> for WithdrawPubInputsBytes {
    fn from(knowledge: WithdrawProverKnowledge<Fr>) -> Self {
        WithdrawPubInputsBytes {
            merkle_root: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::MerkleRoot),
            ),
            h_nullifier_old: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::HashedOldNullifier),
            ),
            h_note_new: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::HashedNewNote),
            ),
            withdrawal_value: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::WithdrawalValue),
            ),
            token_address: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::TokenAddress),
            ),
            commitment: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::Commitment),
            ),
            mac_salt: field_to_bytes(knowledge.compute_public_input(WithdrawInstance::MacSalt)),
            mac_commitment: field_to_bytes(
                knowledge.compute_public_input(WithdrawInstance::MacCommitment),
            ),
        }
    }
}

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Object))]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[derive(Clone, Debug)]
pub struct WithdrawCircuit(super::WithdrawCircuit);

#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
impl WithdrawCircuit {
    #[cfg_attr(feature = "build-uniffi", uniffi::constructor)]
    #[cfg_attr(feature = "build-wasm", wasm_bindgen(constructor))]
    pub fn new_pronto(params_buf: &[u8], pk_buf: &[u8]) -> Self {
        WithdrawCircuit(super::WithdrawCircuit::new_pronto(params_buf, pk_buf))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn prove(
        &self,
        id: Vec<u8>,
        nullifier_old: Vec<u8>,
        trapdoor_old: Vec<u8>,
        account_balance_old: Vec<u8>,
        token_address: Vec<u8>,
        path: Vec<u8>,
        value: Vec<u8>,
        nullifier_new: Vec<u8>,
        trapdoor_new: Vec<u8>,
        commitment: Vec<u8>,
        mac_salt: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &WithdrawProverKnowledge {
                id: vec_to_f(id),
                nullifier_old: vec_to_f(nullifier_old),
                trapdoor_old: vec_to_f(trapdoor_old),
                account_old_balance: vec_to_f(account_balance_old),
                token_address: vec_to_f(token_address),
                path: vec_to_path(path),
                withdrawal_value: vec_to_f(value),
                nullifier_new: vec_to_f(nullifier_new),
                trapdoor_new: vec_to_f(trapdoor_new),
                commitment: vec_to_f(commitment),
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
        commitment: Vec<u8>,
        token_address: Vec<u8>,
        mac_salt: Vec<u8>,
        mac_commitment: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: WithdrawInstance| {
            let value = match input {
                WithdrawInstance::MerkleRoot => &merkle_root,
                WithdrawInstance::HashedOldNullifier => &h_nullifier_old,
                WithdrawInstance::HashedNewNote => &h_note_new,
                WithdrawInstance::WithdrawalValue => &value,
                WithdrawInstance::Commitment => &commitment,
                WithdrawInstance::TokenAddress => &token_address,
                WithdrawInstance::MacSalt => &mac_salt,
                WithdrawInstance::MacCommitment => &mac_commitment,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(Into::into)
    }
}

#[allow(clippy::too_many_arguments)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn withdraw_pub_inputs(
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
    commitment: Vec<u8>,
    mac_salt: Vec<u8>,
) -> WithdrawPubInputsBytes {
    let knowledge = WithdrawProverKnowledge {
        id: vec_to_f(id),
        nullifier_old: vec_to_f(nullifier_old),
        trapdoor_old: vec_to_f(trapdoor_old),
        account_old_balance: vec_to_f(account_balance_old),
        token_address: vec_to_f(token_address),
        path: vec_to_path(path),
        withdrawal_value: vec_to_f(value),
        nullifier_new: vec_to_f(nullifier_new),
        trapdoor_new: vec_to_f(trapdoor_new),
        commitment: vec_to_f(commitment),
        mac_salt: vec_to_f(mac_salt),
    };

    knowledge.into()
}
