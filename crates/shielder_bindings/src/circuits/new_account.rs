use alloc::vec::Vec;

use shielder_circuits::new_account::{NewAccountInstance, NewAccountProverKnowledge};
use shielder_setup::native_token::NATIVE_TOKEN_ADDRESS;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use super::error::VerificationError;
use crate::utils::vec_to_f;

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
        anonymity_revoker_public_key: Vec<u8>,
    ) -> Vec<u8> {
        self.0.prove(
            &NewAccountProverKnowledge {
                id: vec_to_f(id),
                nullifier: vec_to_f(nullifier),
                trapdoor: vec_to_f(trapdoor),
                initial_deposit: vec_to_f(initial_deposit),
                token_address: NATIVE_TOKEN_ADDRESS,
                anonymity_revoker_public_key: vec_to_f(anonymity_revoker_public_key),
            },
            &mut rand::thread_rng(),
        )
    }

    pub fn verify(
        &self,
        h_note: Vec<u8>,
        h_id: Vec<u8>,
        initial_deposit: Vec<u8>,
        proof: Vec<u8>,
        anonymity_revoker_public_key: Vec<u8>,
        sym_key_encryption: Vec<u8>,
    ) -> Result<(), VerificationError> {
        let public_input = |input: NewAccountInstance| {
            let value = match input {
                NewAccountInstance::HashedId => &h_id,
                NewAccountInstance::HashedNote => &h_note,
                NewAccountInstance::InitialDeposit => &initial_deposit,
                NewAccountInstance::TokenAddress => &NATIVE_TOKEN_ADDRESS.to_bytes().to_vec(),
                NewAccountInstance::AnonymityRevokerPublicKey => &anonymity_revoker_public_key,
                NewAccountInstance::SymKeyEncryption => &sym_key_encryption,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(Into::into)
    }
}
