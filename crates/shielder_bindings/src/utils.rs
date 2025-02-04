use alloc::vec::Vec;

use shielder_circuits::{
    consts::{
        merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
        POSEIDON_RATE,
    },
    poseidon::off_circuit::hash,
    FieldExt, F,
};
use type_conversions::bytes_to_field;

/// Hashes a variable-length input using const-length Poseidon
pub fn hash_variable_length<F: FieldExt>(input: &[F]) -> F {
    const RANGE_BOUND: usize = POSEIDON_RATE + 1;

    match input.len() {
        1 => hash::<F, 1>(input.try_into().expect("Safe to unwrap - checked length")),
        2 => hash::<F, 2>(input.try_into().expect("Safe to unwrap - checked length")),
        3 => hash::<F, 3>(input.try_into().expect("Safe to unwrap - checked length")),
        4 => hash::<F, 4>(input.try_into().expect("Safe to unwrap - checked length")),
        5 => hash::<F, 5>(input.try_into().expect("Safe to unwrap - checked length")),
        6 => hash::<F, 6>(input.try_into().expect("Safe to unwrap - checked length")),
        7 => hash::<F, 7>(input.try_into().expect("Safe to unwrap - checked length")),
        0 | RANGE_BOUND.. => panic!(
            "Invalid input length to hash function, expected len between 1 and {}",
            POSEIDON_RATE
        ),
    }
}

pub fn vec_to_f(v: Vec<u8>) -> F {
    bytes_to_field(v).expect("failed to convert to F")
}

pub fn vec_to_path(v: Vec<u8>) -> [[F; ARITY]; NOTE_TREE_HEIGHT] {
    assert_eq!(
        NOTE_TREE_HEIGHT * ARITY * F::size(),
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
