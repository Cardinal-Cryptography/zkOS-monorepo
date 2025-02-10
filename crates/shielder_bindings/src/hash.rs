use alloc::vec::Vec;

use shielder_circuits::{consts::POSEIDON_RATE, Fr};
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use crate::utils::{hash_variable_length, vec_to_f};

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn poseidon_rate() -> u32 {
    POSEIDON_RATE.try_into().unwrap()
}

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn poseidon_hash(inputs: Vec<u8>) -> Vec<u8> {
    if inputs.len() % Fr::size() != 0 {
        panic!("Input length must be divisible by Fr::size()");
    }
    let vec = inputs
        .chunks_exact(Fr::size())
        .map(|v| vec_to_f(v.to_vec()))
        .collect::<Vec<Fr>>();
    hash_variable_length(&vec).to_bytes().as_slice().into()
}
