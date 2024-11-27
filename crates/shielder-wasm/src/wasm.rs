use alloc::vec::Vec;

use halo2_proofs::halo2curves::bn256::Fr;
use shielder_circuits::{
    consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
    utils::padded_hash,
    F,
};
use shielder_rust_sdk::conversion::private_key_to_field;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::vec_to_f;

#[wasm_bindgen]
pub fn arity() -> usize {
    ARITY
}

#[wasm_bindgen]
pub fn tree_height() -> usize {
    NOTE_TREE_HEIGHT
}

#[wasm_bindgen]
pub fn padded_poseidon_hash(inputs: Vec<u8>) -> Vec<u8> {
    if inputs.len() % F::size() != 0 {
        panic!("Input length must be divisible by F::size()");
    }
    let vec = inputs
        .chunks_exact(F::size())
        .map(|v| vec_to_f(v.to_vec()))
        .collect::<Vec<F>>();
    padded_hash(&vec).to_bytes().as_slice().into()
}

#[wasm_bindgen]
pub fn private_key_to_f(hex: &str) -> Vec<u8> {
    private_key_to_field::<Fr>(hex)
        .unwrap()
        .to_bytes()
        .as_slice()
        .into()
}
