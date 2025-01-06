use alloc::vec::Vec;

use halo2_proofs::halo2curves::bn256::Fr;
use shielder_rust_sdk::conversion::private_key_to_field;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
pub fn private_key_to_f(hex: &str) -> Vec<u8> {
    private_key_to_field::<Fr>(hex)
        .unwrap()
        .to_bytes()
        .as_slice()
        .into()
}
