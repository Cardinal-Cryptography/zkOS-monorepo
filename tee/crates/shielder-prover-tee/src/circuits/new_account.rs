use std::vec::Vec;

use serde::{Deserialize, Serialize};
use shielder_circuits::{
    field_element_to_le_bits,
    new_account::{NewAccountInstance, NewAccountProverKnowledge},
    Fr, GrumpkinPointAffine, PublicInputProvider,
};
use type_conversions::field_to_bytes;

use crate::circuits::{vec_to_f, SerializableCircuit};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct NewAccountPubInputsBytes {
    pub hashed_note: Vec<u8>,
    pub prenullifier: Vec<u8>,
    pub initial_deposit: Vec<u8>,
    pub caller_address: Vec<u8>,
    pub token_address: Vec<u8>,
    pub anonymity_revoker_public_key_x: Vec<u8>,
    pub anonymity_revoker_public_key_y: Vec<u8>,
    pub sym_key_encryption_1_x: Vec<u8>,
    pub sym_key_encryption_1_y: Vec<u8>,
    pub sym_key_encryption_2_x: Vec<u8>,
    pub sym_key_encryption_2_y: Vec<u8>,
    pub mac_salt: Vec<u8>,
    pub mac_commitment: Vec<u8>,
}

impl From<NewAccountProverKnowledge<Fr>> for NewAccountPubInputsBytes {
    fn from(knowledge: NewAccountProverKnowledge<Fr>) -> Self {
        NewAccountPubInputsBytes {
            hashed_note: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::HashedNote),
            ),
            prenullifier: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::Prenullifier),
            ),
            initial_deposit: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::InitialDeposit),
            ),
            caller_address: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::CallerAddress),
            ),
            token_address: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::TokenAddress),
            ),
            anonymity_revoker_public_key_x: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::AnonymityRevokerPublicKeyX),
            ),
            anonymity_revoker_public_key_y: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::AnonymityRevokerPublicKeyY),
            ),
            sym_key_encryption_1_x: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext1X),
            ),
            sym_key_encryption_1_y: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext1Y),
            ),
            sym_key_encryption_2_x: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext2X),
            ),
            sym_key_encryption_2_y: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext2Y),
            ),
            mac_salt: field_to_bytes(knowledge.compute_public_input(NewAccountInstance::MacSalt)),
            mac_commitment: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::MacCommitment),
            ),
        }
    }
}

#[derive(Clone, Debug)]
pub struct NewAccountCircuit(super::NewAccountCircuit);

impl NewAccountCircuit {
    pub fn new() -> Self {
        NewAccountCircuit(super::NewAccountCircuit::new_pronto(
            include_bytes!("../../artifacts/new_account/params.bin"),
            include_bytes!("../../artifacts/new_account/pk.bin"),
        ))
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct NewAccountProveInputsBytes {
    id: Vec<u8>,
    nullifier: Vec<u8>,
    initial_deposit: Vec<u8>,
    caller_address: Vec<u8>,
    token_address: Vec<u8>,
    encryption_salt: Vec<u8>,
    mac_salt: Vec<u8>,
    anonymity_revoker_public_key_x: Vec<u8>,
    anonymity_revoker_public_key_y: Vec<u8>,
}

impl SerializableCircuit for NewAccountCircuit {
    type Input = NewAccountProveInputsBytes;
    type Output = NewAccountPubInputsBytes;

    fn prove(&self, new_account_bytes: NewAccountProveInputsBytes) -> Vec<u8> {
        self.0.prove(
            &NewAccountProverKnowledge {
                id: vec_to_f(new_account_bytes.id),
                nullifier: vec_to_f(new_account_bytes.nullifier),
                initial_deposit: vec_to_f(new_account_bytes.initial_deposit),
                caller_address: vec_to_f(new_account_bytes.caller_address),
                token_address: vec_to_f(new_account_bytes.token_address),
                encryption_salt: field_element_to_le_bits(vec_to_f(
                    new_account_bytes.encryption_salt,
                )),
                mac_salt: vec_to_f(new_account_bytes.mac_salt),
                anonymity_revoker_public_key: GrumpkinPointAffine {
                    x: vec_to_f(new_account_bytes.anonymity_revoker_public_key_x),
                    y: vec_to_f(new_account_bytes.anonymity_revoker_public_key_y),
                },
            },
            &mut rand::thread_rng(),
        )
    }

    fn pub_inputs(
        new_account_prove_inputs_bytes: NewAccountProveInputsBytes,
    ) -> NewAccountPubInputsBytes {
        let knowledge = NewAccountProverKnowledge {
            id: vec_to_f(new_account_prove_inputs_bytes.id),
            nullifier: vec_to_f(new_account_prove_inputs_bytes.nullifier),
            initial_deposit: vec_to_f(new_account_prove_inputs_bytes.initial_deposit),
            caller_address: vec_to_f(new_account_prove_inputs_bytes.caller_address),
            token_address: vec_to_f(new_account_prove_inputs_bytes.token_address),
            encryption_salt: field_element_to_le_bits(vec_to_f(
                new_account_prove_inputs_bytes.encryption_salt,
            )),
            mac_salt: vec_to_f(new_account_prove_inputs_bytes.mac_salt),
            anonymity_revoker_public_key: GrumpkinPointAffine {
                x: vec_to_f(new_account_prove_inputs_bytes.anonymity_revoker_public_key_x),
                y: vec_to_f(new_account_prove_inputs_bytes.anonymity_revoker_public_key_y),
            },
        };

        knowledge.into()
    }
}

pub type SerializableNewAccountCircuit = NewAccountCircuit;
