use alloy_primitives::U256;
use rand::{rngs::OsRng, Rng};
use sha3::Digest;
use shielder_circuits::consts::NONCE_UPPER_LIMIT;

const NULLIFIER_LABEL: &[u8] = b"nullifier";
const TRAPDOOR_LABEL: &[u8] = b"trapdoor";

// Copied from `src/bn256/fr.rs` in `halo2curves`. Unfortunately only a string constant is public
// in `halo2curves`, and we need bytes for performance reasons.
const FIELD_MODULUS: U256 = U256::from_limbs([
    0x43e1f593f0000001,
    0x2833e84879b97091,
    0xb85045b68181585d,
    0x30644e72e131a029,
]);

/// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
pub fn nullifier(id: U256, nonce: u32) -> U256 {
    hash(id, nonce, NULLIFIER_LABEL)
}

/// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
pub fn trapdoor(id: U256, nonce: u32) -> U256 {
    hash(id, nonce, TRAPDOOR_LABEL)
}

fn hash(id: U256, nonce: u32, label: &[u8]) -> U256 {
    let mut hasher = sha3::Keccak256::new();
    hasher.update(id.to_be_bytes_vec());
    hasher.update(label);
    hasher.update(nonce.to_be_bytes());
    U256::from_be_slice(hasher.finalize().as_slice()).reduce_mod(FIELD_MODULUS)
}

pub fn id_hiding_nonce() -> U256 {
    let mut rng = OsRng;
    let nonce = rng.gen_range(0..NONCE_UPPER_LIMIT);

    U256::from(nonce)
}

#[cfg(test)]
mod tests {
    use alloy_primitives::U256;
    use halo2curves::{bn256::Fr, ff::PrimeField};

    use super::FIELD_MODULUS;

    #[test]
    pub fn modulus_constant_is_correct() {
        assert_eq!(
            FIELD_MODULUS,
            U256::from_str_radix(Fr::MODULUS.strip_prefix("0x").unwrap(), 16).unwrap()
        );
    }
}
