use std::vec::Vec;

use serde::{Deserialize, Serialize};
use shielder_circuits::{
    deposit::{DepositInstance, DepositProverKnowledge},
    Fr, PublicInputProvider,
};
use type_conversions::field_to_bytes;

use crate::circuits::{vec_to_f, vec_to_path, SerializableCircuit};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct DepositPubInputsBytes {
    pub merkle_root: Vec<u8>,
    pub h_nullifier_old: Vec<u8>,
    pub h_note_new: Vec<u8>,
    pub value: Vec<u8>,
    pub caller_address: Vec<u8>,
    pub token_address: Vec<u8>,
    pub mac_salt: Vec<u8>,
    pub mac_commitment: Vec<u8>,
}

impl From<DepositProverKnowledge<Fr>> for DepositPubInputsBytes {
    fn from(knowledge: DepositProverKnowledge<Fr>) -> Self {
        DepositPubInputsBytes {
            merkle_root: field_to_bytes(
                knowledge.compute_public_input(DepositInstance::MerkleRoot),
            ),
            h_nullifier_old: field_to_bytes(
                knowledge.compute_public_input(DepositInstance::HashedOldNullifier),
            ),
            h_note_new: field_to_bytes(
                knowledge.compute_public_input(DepositInstance::HashedNewNote),
            ),
            value: field_to_bytes(knowledge.compute_public_input(DepositInstance::DepositValue)),
            caller_address: field_to_bytes(
                knowledge.compute_public_input(DepositInstance::CallerAddress),
            ),
            token_address: field_to_bytes(
                knowledge.compute_public_input(DepositInstance::TokenAddress),
            ),
            mac_salt: field_to_bytes(knowledge.compute_public_input(DepositInstance::MacSalt)),
            mac_commitment: field_to_bytes(
                knowledge.compute_public_input(DepositInstance::MacCommitment),
            ),
        }
    }
}

#[derive(Clone, Debug)]
pub struct DepositCircuit(super::DepositCircuit);

impl DepositCircuit {
    pub fn new() -> Self {
        DepositCircuit(super::DepositCircuit::new_pronto(
            include_bytes!("../../artifacts/deposit/params.bin"),
            include_bytes!("../../artifacts/deposit/pk.bin"),
        ))
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct DepositProveInputBytes {
    id: Vec<u8>,
    nullifier_old: Vec<u8>,
    account_balance_old: Vec<u8>,
    token_address: Vec<u8>,
    path: Vec<u8>,
    value: Vec<u8>,
    caller_address: Vec<u8>,
    nullifier_new: Vec<u8>,
    mac_salt: Vec<u8>,
}

impl SerializableCircuit for DepositCircuit {
    type Input = DepositProveInputBytes;
    type Output = DepositPubInputsBytes;

    fn prove(&self, deposit_prove_input_bytes: DepositProveInputBytes) -> Vec<u8> {
        self.0.prove(
            &DepositProverKnowledge {
                id: vec_to_f(deposit_prove_input_bytes.id),
                nullifier_old: vec_to_f(deposit_prove_input_bytes.nullifier_old),
                account_old_balance: vec_to_f(deposit_prove_input_bytes.account_balance_old),
                token_address: vec_to_f(deposit_prove_input_bytes.token_address),
                path: vec_to_path(deposit_prove_input_bytes.path),
                deposit_value: vec_to_f(deposit_prove_input_bytes.value),
                caller_address: vec_to_f(deposit_prove_input_bytes.caller_address),
                nullifier_new: vec_to_f(deposit_prove_input_bytes.nullifier_new),
                mac_salt: vec_to_f(deposit_prove_input_bytes.mac_salt),
            },
            &mut rand::thread_rng(),
        )
    }

    fn pub_inputs(deposit_prove_input_bytes: DepositProveInputBytes) -> DepositPubInputsBytes {
        let knowledge = DepositProverKnowledge {
            id: vec_to_f(deposit_prove_input_bytes.id),
            nullifier_old: vec_to_f(deposit_prove_input_bytes.nullifier_old),
            account_old_balance: vec_to_f(deposit_prove_input_bytes.account_balance_old),
            token_address: vec_to_f(deposit_prove_input_bytes.token_address),
            path: vec_to_path(deposit_prove_input_bytes.path),
            deposit_value: vec_to_f(deposit_prove_input_bytes.value),
            caller_address: vec_to_f(deposit_prove_input_bytes.caller_address),
            nullifier_new: vec_to_f(deposit_prove_input_bytes.nullifier_new),
            mac_salt: vec_to_f(deposit_prove_input_bytes.mac_salt),
        };

        knowledge.into()
    }
}

pub type SerializableDepositCircuit = DepositCircuit;
