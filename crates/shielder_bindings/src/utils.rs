use alloc::vec::Vec;

use shielder_circuits::{
    consts::{
        merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
        POSEIDON_RATE,
    },
    poseidon::off_circuit::hash,
    FieldExt, F,
};
use shielder_circuits_v0_1_0::consts::NUM_TOKENS;
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

pub fn vec_to_token_list(v: Vec<u8>) -> [F; NUM_TOKENS] {
    vec_to_array(v)
}

pub fn vec_to_path(v: Vec<u8>) -> [[F; ARITY]; NOTE_TREE_HEIGHT] {
    // Convert to flat array first
    let flat: [F; NOTE_TREE_HEIGHT * ARITY] = vec_to_array(v);

    // Reshape into 2D array
    let mut result = [[F::default(); ARITY]; NOTE_TREE_HEIGHT];
    for i in 0..NOTE_TREE_HEIGHT {
        for j in 0..ARITY {
            result[i][j] = flat[i * ARITY + j];
        }
    }

    result
}

// a generic function to convert a vector of bytes to a array of const length of F elements
pub fn vec_to_array<const N: usize>(v: Vec<u8>) -> [F; N] {
    assert_eq!(
        N * F::size(),
        v.len(),
        "Vector length must be divisible by {} * F::size()",
        N
    );

    let mut result = [F::default(); N];
    let mut iter = v.chunks_exact(F::size());

    for elem in result.iter_mut().take(N) {
        if let Some(chunk) = iter.next() {
            *elem = F::from_bytes(
                chunk
                    .try_into()
                    .unwrap_or_else(|_| panic!("should be {} bytes long", F::size())),
            )
            .expect("failed to convert to F");
        }
    }

    result
}

#[cfg(test)]
#[cfg(feature = "std")]
mod tests {
    extern crate std;

    use alloc::vec;

    use super::*;

    fn create_test_bytes_field(field_elements: usize) -> Vec<u8> {
        (0..field_elements)
            .map(|i| F::from(i as u64).to_bytes())
            .collect::<Vec<[u8; 32]>>()
            .concat()
    }

    #[test]
    fn test_hash_variable_length() {
        // Test different input lengths
        let inputs = vec![
            vec![F::from(1)],
            vec![F::from(1), F::from(2)],
            vec![F::from(1), F::from(2), F::from(3)],
        ];

        for input in inputs {
            let result = hash_variable_length(&input);
            assert!(result != F::default(), "Hash should not be zero");
        }

        // Test invalid length
        let empty: Vec<F> = vec![];
        let too_long = vec![F::from(1); POSEIDON_RATE + 1];

        assert!(std::panic::catch_unwind(|| hash_variable_length(&empty)).is_err());
        assert!(std::panic::catch_unwind(|| hash_variable_length(&too_long)).is_err());
    }

    #[test]
    fn test_vec_to_f() {
        let bytes = F::from(1).to_bytes();
        let result = vec_to_f(Vec::from(bytes));
        assert_eq!(result, F::from(1), "Should have correct value");
    }

    #[test]
    fn test_vec_to_token_list() {
        let bytes = create_test_bytes_field(NUM_TOKENS);
        let result = vec_to_token_list(bytes);
        assert_eq!(
            result.len(),
            NUM_TOKENS,
            "Should have correct number of tokens"
        );

        // Test invalid length
        let invalid_bytes = create_test_bytes_field(NUM_TOKENS + 1);
        assert!(std::panic::catch_unwind(|| vec_to_token_list(invalid_bytes)).is_err());
    }

    #[test]
    fn test_vec_to_path() {
        let bytes = create_test_bytes_field(NOTE_TREE_HEIGHT * ARITY);
        let result = vec_to_path(bytes);

        assert_eq!(result.len(), NOTE_TREE_HEIGHT, "Should have correct height");
        assert_eq!(result[0].len(), ARITY, "Should have correct arity");

        // Test invalid length
        let invalid_bytes = create_test_bytes_field(NOTE_TREE_HEIGHT * ARITY + 1);
        assert!(std::panic::catch_unwind(|| vec_to_path(invalid_bytes)).is_err());
    }

    #[test]
    fn test_vec_to_array() {
        const TEST_SIZE: usize = 3;
        let bytes = create_test_bytes_field(TEST_SIZE);
        let result: [F; TEST_SIZE] = vec_to_array(bytes);

        assert_eq!(result.len(), TEST_SIZE, "Should have correct length");

        // Test invalid length
        let invalid_bytes = create_test_bytes_field(TEST_SIZE + 1);
        let result = std::panic::catch_unwind(|| vec_to_array::<TEST_SIZE>(invalid_bytes));
        assert!(result.is_err());
    }
}
