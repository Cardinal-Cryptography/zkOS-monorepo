use alloc::vec::Vec;

use shielder_circuits::{
    consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
    F,
};
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

use crate::utils::{hash_variable_length, vec_to_f};

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn arity() -> u32 {
    ARITY.try_into().unwrap()
}

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn tree_height() -> u32 {
    NOTE_TREE_HEIGHT.try_into().unwrap()
}

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
pub fn poseidon_hash(inputs: Vec<u8>) -> Vec<u8> {
    if inputs.len() % F::size() != 0 {
        panic!("Input length must be divisible by F::size()");
    }
    let vec = inputs
        .chunks_exact(F::size())
        .map(|v| vec_to_f(v.to_vec()))
        .collect::<Vec<F>>();
    hash_variable_length(&vec).to_bytes().as_slice().into()
}
