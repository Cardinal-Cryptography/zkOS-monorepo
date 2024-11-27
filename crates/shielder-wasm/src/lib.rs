#![no_std]

extern crate alloc;

pub mod circuits;
pub mod secrets;
pub mod wasm;

use alloc::vec::Vec;

use shielder_circuits::{
    consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
    F,
};
use shielder_rust_sdk::conversion::bytes_to_field;
#[cfg(feature = "multithreading")]
pub use wasm_bindgen_rayon::init_thread_pool;

fn vec_to_f(v: Vec<u8>) -> F {
    bytes_to_field(v).expect("failed to convert to F")
}

fn vec_to_path(v: Vec<u8>) -> [[F; ARITY]; NOTE_TREE_HEIGHT] {
    assert_eq!(
        (NOTE_TREE_HEIGHT * ARITY * F::size()),
        v.len(),
        "Vector length must be divisible by TREE_HEIGHT * ARITY * F::size()"
    );

    let mut result = [[F::default(); ARITY]; NOTE_TREE_HEIGHT];
    let mut iter = v.chunks_exact(F::size());

    for row in result.iter_mut().take(NOTE_TREE_HEIGHT) {
        for elem in row.iter_mut().take(ARITY) {
            if let Some(chunk) = iter.next() {
                *elem = F::from_bytes(
                    chunk
                        .try_into()
                        .unwrap_or_else(|_| panic!("should be {} bytes long", F::size())),
                )
                .expect("failed to convert to F");
            }
        }
    }

    result
}
