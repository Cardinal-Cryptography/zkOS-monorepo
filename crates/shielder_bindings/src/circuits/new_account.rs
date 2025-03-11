use alloc::vec::Vec;

use shielder_circuits::{
    field_element_to_le_bits,
    new_account::{NewAccountInstance, NewAccountProverKnowledge},
    Fr, GrumpkinPointAffine, PublicInputProvider,
};
use type_conversions::field_to_bytes;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use super::error::VerificationError;
use crate::utils::vec_to_f;

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Record))]
// `getter_with_clone` is required for `Vec<u8>` struct fields
#[cfg_attr(feature = "build-wasm", wasm_bindgen(getter_with_clone))]
#[derive(Clone, Debug, Default)]
pub struct NewAccountPubInputsBytes {
    pub hashed_note: Vec<u8>,
    pub prenullifier: Vec<u8>,
    pub initial_deposit: Vec<u8>,
    pub token_address: Vec<u8>,
    pub anonymity_revoker_public_key_x: Vec<u8>,
    pub anonymity_revoker_public_key_y: Vec<u8>,
    pub sym_key_encryption_1_x: Vec<u8>,
    pub sym_key_encryption_1_y: Vec<u8>,
    pub sym_key_encryption_2_x: Vec<u8>,
    pub sym_key_encryption_2_y: Vec<u8>,
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
                knowledge.compute_public_input(NewAccountInstance::AnonymityRevokerPublicKeyX),
            ),
            sym_key_encryption_1_y: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext2X),
            ),
            sym_key_encryption_2_x: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext2X),
            ),
            sym_key_encryption_2_y: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::EncryptedKeyCiphertext2Y),
            ),
        }
    }
}

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Object))]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[derive(Clone, Debug)]
pub struct NewAccountCircuit(super::NewAccountCircuit);

#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
impl NewAccountCircuit {
    #[cfg_attr(feature = "build-uniffi", uniffi::constructor)]
    #[cfg_attr(feature = "build-wasm", wasm_bindgen(constructor))]
    pub fn new_pronto(params_buf: &[u8], pk_buf: &[u8]) -> Self {
        NewAccountCircuit(super::NewAccountCircuit::new_pronto(params_buf, pk_buf))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn prove(
        &self,
        id: Vec<u8>,
        nullifier: Vec<u8>,
        trapdoor: Vec<u8>,
        initial_deposit: Vec<u8>,
        token_address: Vec<u8>,
        encryption_salt: Vec<u8>,
        mac_salt: Vec<u8>,
        anonymity_revoker_public_key_x: Vec<u8>,
        anonymity_revoker_public_key_y: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &NewAccountProverKnowledge {
                id: vec_to_f(id),
                nullifier: vec_to_f(nullifier),
                trapdoor: vec_to_f(trapdoor),
                initial_deposit: vec_to_f(initial_deposit),
                token_address: vec_to_f(token_address),
                encryption_salt: field_element_to_le_bits(vec_to_f(encryption_salt)),
                mac_salt: vec_to_f(mac_salt),
                anonymity_revoker_public_key: GrumpkinPointAffine {
                    x: vec_to_f(anonymity_revoker_public_key_x),
                    y: vec_to_f(anonymity_revoker_public_key_y),
                },
            },
            &mut rand::thread_rng(),
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn verify(
        &self,
        h_note: Vec<u8>,
        h_id: Vec<u8>,
        initial_deposit: Vec<u8>,
        token_address: Vec<u8>,
        anonymity_revoker_public_key_x: Vec<u8>,
        anonymity_revoker_public_key_y: Vec<u8>,
        sym_key_encryption_1_x: Vec<u8>,
        sym_key_encryption_1_y: Vec<u8>,
        sym_key_encryption_2_x: Vec<u8>,
        sym_key_encryption_2_y: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: NewAccountInstance| {
            let value = match input {
                NewAccountInstance::HashedId => &h_id,
                NewAccountInstance::HashedNote => &h_note,
                NewAccountInstance::InitialDeposit => &initial_deposit,
                NewAccountInstance::TokenAddress => &token_address,
                NewAccountInstance::AnonymityRevokerPublicKeyX => &anonymity_revoker_public_key_x,
                NewAccountInstance::AnonymityRevokerPublicKeyY => &anonymity_revoker_public_key_y,
                NewAccountInstance::EncryptedKeyCiphertext1X => &sym_key_encryption_1_x,
                NewAccountInstance::EncryptedKeyCiphertext1Y => &sym_key_encryption_1_y,
                NewAccountInstance::EncryptedKeyCiphertext2X => &sym_key_encryption_2_x,
                NewAccountInstance::EncryptedKeyCiphertext2Y => &sym_key_encryption_2_y,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(Into::into)
    }
}

#[allow(clippy::too_many_arguments)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn new_account_pub_inputs(
    id: Vec<u8>,
    nullifier: Vec<u8>,
    trapdoor: Vec<u8>,
    initial_deposit: Vec<u8>,
    token_address: Vec<u8>,
    encryption_salt: Vec<u8>, // vector of bits
    mac_salt: Vec<u8>,
    anonymity_revoker_public_key_x: Vec<u8>,
    anonymity_revoker_public_key_y: Vec<u8>,
) -> NewAccountPubInputsBytes {
    let knowledge = NewAccountProverKnowledge {
        id: vec_to_f(id),
        nullifier: vec_to_f(nullifier),
        trapdoor: vec_to_f(trapdoor),
        initial_deposit: vec_to_f(initial_deposit),
        token_address: vec_to_f(token_address),
        encryption_salt: field_element_to_le_bits(vec_to_f(encryption_salt)),
        mac_salt: vec_to_f(mac_salt),
        anonymity_revoker_public_key: GrumpkinPointAffine {
            x: vec_to_f(anonymity_revoker_public_key_x),
            y: vec_to_f(anonymity_revoker_public_key_y),
        },
    };

    knowledge.into()
}
