use alloc::vec::Vec;

use shielder_rust_sdk::{
    account::secrets::{nullifier, trapdoor},
    alloy_primitives::U256,
};
use type_conversions::{bytes_to_u256, u256_to_bytes};
use wasm_bindgen::prelude::wasm_bindgen;

/// Provides a way to print debug messages from Rust code to browser console.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

type Scalar = Vec<u8>;

#[wasm_bindgen(getter_with_clone)] // `getter_with_clone` is required for `Vec<u8>` struct fields
#[derive(Clone, Debug, Default)]
pub struct ShielderActionSecrets {
    pub nullifier: Scalar,
    pub trapdoor: Scalar,
}

/// Deterministically computes `ShielderActionSecrets` from `nonce` and `id`.
/// All returned values are field elements.
#[wasm_bindgen]
pub fn get_action_secrets(id: Scalar, nonce: u32) -> ShielderActionSecrets {
    let id: U256 = bytes_to_u256(id).expect("Expecting a 32-byte vector");

    ShielderActionSecrets {
        nullifier: u256_to_bytes(nullifier(id, nonce)),
        trapdoor: u256_to_bytes(trapdoor(id, nonce)),
    }
}
