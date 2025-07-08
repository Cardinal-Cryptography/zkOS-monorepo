use std::vec::Vec;
use serde::{Deserialize, Serialize};
use shielder_circuits::{
    withdraw::{WithdrawInstance, WithdrawProverKnowledge},
    Fr, PublicInputProvider,
};
use type_conversions::field_to_bytes;
use crate::circuits::{vec_to_f, vec_to_path};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
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

#[derive(Clone, Debug)]
pub struct WithdrawCircuit(super::WithdrawCircuit);

impl WithdrawCircuit {
    pub fn new() -> Self {
        WithdrawCircuit(super::WithdrawCircuit::new_pronto(
            include_bytes!("../../artifacts/withdraw/params.bin"),
            include_bytes!("../../artifacts/withdraw/pk.bin"),
        ))
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct WithdrawProveInputsBytes {
    id: Vec<u8>,
    nullifier_old: Vec<u8>,
    account_balance_old: Vec<u8>,
    token_address: Vec<u8>,
    path: Vec<u8>,
    value: Vec<u8>,
    nullifier_new: Vec<u8>,
    commitment: Vec<u8>,
    mac_salt: Vec<u8>,
}

impl WithdrawCircuit {
    pub fn prove(
        &self,
       withdraw_prove_inputs_bytes: WithdrawProveInputsBytes,
    ) -> Vec<u8> {
        self.0.prove(
            &WithdrawProverKnowledge {
                id: vec_to_f(withdraw_prove_inputs_bytes.id),
                nullifier_old: vec_to_f(withdraw_prove_inputs_bytes.nullifier_old),
                account_old_balance: vec_to_f(withdraw_prove_inputs_bytes.account_balance_old),
                token_address: vec_to_f(withdraw_prove_inputs_bytes.token_address),
                path: vec_to_path(withdraw_prove_inputs_bytes.path),
                withdrawal_value: vec_to_f(withdraw_prove_inputs_bytes.value),
                nullifier_new: vec_to_f(withdraw_prove_inputs_bytes.nullifier_new),
                commitment: vec_to_f(withdraw_prove_inputs_bytes.commitment),
                mac_salt: vec_to_f(withdraw_prove_inputs_bytes.mac_salt),
            },
            &mut rand::thread_rng(),
        )
    }
}

pub fn withdraw_pub_inputs(
    withdraw_prove_inputs_bytes: WithdrawProveInputsBytes,
) -> WithdrawPubInputsBytes {
    let knowledge = WithdrawProverKnowledge {
        id: vec_to_f(withdraw_prove_inputs_bytes.id),
        nullifier_old: vec_to_f(withdraw_prove_inputs_bytes.nullifier_old),
        account_old_balance: vec_to_f(withdraw_prove_inputs_bytes.account_balance_old),
        token_address: vec_to_f(withdraw_prove_inputs_bytes.token_address),
        path: vec_to_path(withdraw_prove_inputs_bytes.path),
        withdrawal_value: vec_to_f(withdraw_prove_inputs_bytes.value),
        nullifier_new: vec_to_f(withdraw_prove_inputs_bytes.nullifier_new),
        commitment: vec_to_f(withdraw_prove_inputs_bytes.commitment),
        mac_salt: vec_to_f(withdraw_prove_inputs_bytes.mac_salt),
    };

    knowledge.into()
}
