use alloc::vec::Vec;

use halo2_proofs::halo2curves::bn256::Fr;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn hex_32_to_f(hex: &str) -> Vec<u8> {
    type_conversions::hex_32_to_f::<Fr>(hex)
        .unwrap()
        .to_bytes()
        .as_slice()
        .into()
}
