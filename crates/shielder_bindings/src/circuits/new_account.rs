use alloc::vec::Vec;

use shielder_circuits::{
    new_account::{NewAccountInstance, NewAccountProverKnowledge},
    Fr, PublicInputProvider,
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
pub struct NewAccountPubInputsBridged {
    pub hashed_note: Vec<u8>,
    pub hashed_id: Vec<u8>,
    pub initial_deposit: Vec<u8>,
    pub token_address: Vec<u8>,
    pub anonymity_revoker_public_key: Vec<u8>,
    pub sym_key_encryption: Vec<u8>,
}

impl From<NewAccountProverKnowledge<Fr>> for NewAccountPubInputsBridged {
    fn from(knowledge: NewAccountProverKnowledge<Fr>) -> Self {
        NewAccountPubInputsBridged {
            hashed_note: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::HashedNote),
            ),
            hashed_id: field_to_bytes(knowledge.compute_public_input(NewAccountInstance::HashedId)),
            initial_deposit: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::InitialDeposit),
            ),
            token_address: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::TokenAddress),
            ),
            anonymity_revoker_public_key: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::AnonymityRevokerPublicKey),
            ),
            sym_key_encryption: field_to_bytes(
                knowledge.compute_public_input(NewAccountInstance::SymKeyEncryption),
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
    pub fn new_pronto() -> Self {
        NewAccountCircuit(super::NewAccountCircuit::new_pronto())
    }

    pub fn prove(
        &self,
        id: Vec<u8>,
        nullifier: Vec<u8>,
        trapdoor: Vec<u8>,
        initial_deposit: Vec<u8>,
        token_address: Vec<u8>,
        anonymity_revoker_public_key: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &NewAccountProverKnowledge {
                id: vec_to_f(id),
                nullifier: vec_to_f(nullifier),
                trapdoor: vec_to_f(trapdoor),
                initial_deposit: vec_to_f(initial_deposit),
                token_address: vec_to_f(token_address),
                anonymity_revoker_public_key: vec_to_f(anonymity_revoker_public_key),
            }
            .into(),
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
        anonymity_revoker_public_key: Vec<u8>,
        sym_key_encryption: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: NewAccountInstance| {
            let value = match input {
                NewAccountInstance::HashedId => &h_id,
                NewAccountInstance::HashedNote => &h_note,
                NewAccountInstance::InitialDeposit => &initial_deposit,
                NewAccountInstance::TokenAddress => &token_address,
                NewAccountInstance::AnonymityRevokerPublicKey => &anonymity_revoker_public_key,
                NewAccountInstance::SymKeyEncryption => &sym_key_encryption,
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
    anonymity_revoker_public_key: Vec<u8>,
) -> NewAccountPubInputsBridged {
    let knowledge = NewAccountProverKnowledge {
        id: vec_to_f(id),
        nullifier: vec_to_f(nullifier),
        trapdoor: vec_to_f(trapdoor),
        initial_deposit: vec_to_f(initial_deposit),
        token_address: vec_to_f(token_address),
        anonymity_revoker_public_key: vec_to_f(anonymity_revoker_public_key),
    };

    knowledge.into()
}
