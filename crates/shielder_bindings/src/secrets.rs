use alloc::vec::Vec;

use shielder_rust_sdk::{
    account::secrets::{nullifier, trapdoor},
    alloy_primitives::U256,
};
use type_conversions::{bytes_to_u256, u256_to_bytes};
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
        nullifier: u256_to_bytes(nullifier(id, nonce)),
        trapdoor: u256_to_bytes(trapdoor(id, nonce)),
    }
}
