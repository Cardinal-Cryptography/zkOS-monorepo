use alloc::vec::Vec;

use halo2_proofs::halo2curves::bn256::Fr;
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-server", macros::jsonize)]
pub fn hex_32_to_f(hex: String) -> Vec<u8> {
    type_conversions::hex_32_to_f::<Fr>(&hex)
        .unwrap()
        .to_bytes()
        .as_slice()
        .into()
}
