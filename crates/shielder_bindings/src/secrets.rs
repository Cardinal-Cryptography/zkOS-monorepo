use alloc::vec::Vec;

use alloy_primitives::{hex::FromHex, Address, U256};
use shielder_account::secrets::{
    self,
    nonced::{derive_nullifier, derive_trapdoor},
};
use shielder_circuits::Fr;
use type_conversions::{bytes_to_u256, field_to_bytes, hex_to_u256, u256_to_bytes, u256_to_field};
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Record))]
// `getter_with_clone` is required for `Vec<u8>` struct fields
#[cfg_attr(feature = "build-wasm", wasm_bindgen(getter_with_clone))]
#[derive(Clone, Debug, Default)]
pub struct ShielderActionSecrets {
    pub nullifier: Vec<u8>,
    pub trapdoor: Vec<u8>,
}

/// Deterministically computes `ShielderActionSecrets` from `nonce` and `id`.
/// All returned values are field elements.
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
pub fn get_action_secrets(id: Vec<u8>, nonce: u32) -> ShielderActionSecrets {
    let id: U256 = bytes_to_u256(id).expect("Expecting a 32-byte vector");

    ShielderActionSecrets {
        nullifier: u256_to_bytes(derive_nullifier(id, nonce)),
        trapdoor: u256_to_bytes(derive_trapdoor(id, nonce)),
    }
}

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn derive_id(private_key_hex: &str, chain_id: u64, token_address_hex: &str) -> Vec<u8> {
    let id_seed_u256 = secrets::derive_id(
        hex_to_u256(private_key_hex).unwrap(),
        chain_id,
        Address::from_hex(token_address_hex).unwrap(),
    );
    let id_seed_fr: Fr = u256_to_field(id_seed_u256);
    let on_curve_id = shielder_circuits::generate_user_id(id_seed_fr.to_bytes());
    field_to_bytes(on_curve_id)
}
