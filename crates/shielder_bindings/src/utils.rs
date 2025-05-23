use alloc::vec::Vec;

use shielder_circuits::{
    consts::{
        merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
        POSEIDON_RATE,
    },
    poseidon::off_circuit::hash,
    Fr,
};
use type_conversions::bytes_to_field;

/// Hashes a variable-length input using const-length Poseidon
pub fn hash_variable_length(input: &[Fr]) -> Fr {
    const RANGE_BOUND: usize = POSEIDON_RATE + 1;

    match input.len() {
        1 => hash::<1>(input.try_into().expect("Safe to unwrap - checked length")),
        2 => hash::<2>(input.try_into().expect("Safe to unwrap - checked length")),
        3 => hash::<3>(input.try_into().expect("Safe to unwrap - checked length")),
        4 => hash::<4>(input.try_into().expect("Safe to unwrap - checked length")),
        5 => hash::<5>(input.try_into().expect("Safe to unwrap - checked length")),
        6 => hash::<6>(input.try_into().expect("Safe to unwrap - checked length")),
        7 => hash::<7>(input.try_into().expect("Safe to unwrap - checked length")),
        0 | RANGE_BOUND.. => panic!(
            "Invalid input length to hash function, expected len between 1 and {}",
            POSEIDON_RATE
        ),
    }
}

pub fn vec_to_f(v: Vec<u8>) -> Fr {
    bytes_to_field(v).expect("failed to convert to F")
}

pub fn vec_to_path(v: Vec<u8>) -> [[Fr; ARITY]; NOTE_TREE_HEIGHT] {
    assert_eq!(
        NOTE_TREE_HEIGHT * ARITY * Fr::size(),
        v.len(),
        "Vector length must be divisible by TREE_HEIGHT * ARITY * F::size()"
    );

    let mut result = [[Fr::default(); ARITY]; NOTE_TREE_HEIGHT];
    let mut iter = v.chunks_exact(Fr::size());

    for row in result.iter_mut().take(NOTE_TREE_HEIGHT) {
        for elem in row.iter_mut().take(ARITY) {
            if let Some(chunk) = iter.next() {
                *elem = Fr::from_bytes(
                    chunk
                        .try_into()
                        .unwrap_or_else(|_| panic!("should be {} bytes long", Fr::size())),
                )
                .expect("failed to convert to F");
            }
        }
    }

    result
}
