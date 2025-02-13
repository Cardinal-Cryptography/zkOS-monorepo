use alloy_primitives::{Address, U256};
use rand::{rngs::OsRng, Rng};
use sha3::Digest;
use shielder_circuits::consts::NONCE_UPPER_LIMIT;
use type_conversions::address_to_u256;

const NULLIFIER_LABEL: &[u8] = b"nullifier";
const TRAPDOOR_LABEL: &[u8] = b"trapdoor";
const ID_LABEL: &[u8] = b"id";

// Copied from `src/bn256/fr.rs` in `halo2curves`. Unfortunately only a string constant is public
// in `halo2curves`, and we need bytes for performance reasons.
const FIELD_MODULUS: U256 = U256::from_limbs([
    0x43e1f593f0000001,
    0x2833e84879b97091,
    0xb85045b68181585d,
    0x30644e72e131a029,
]);

/// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
pub fn derive_nullifier(id: U256, nonce: u32) -> U256 {
    hash_id_nonce_label(id, nonce, NULLIFIER_LABEL)
}

/// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
pub fn derive_trapdoor(id: U256, nonce: u32) -> U256 {
    hash_id_nonce_label(id, nonce, TRAPDOOR_LABEL)
}

fn hash_id_nonce_label(id: U256, nonce: u32, label: &[u8]) -> U256 {
    let mut hasher = sha3::Keccak256::new();
    hasher.update(id.to_be_bytes_vec());
    hasher.update(label);
    hasher.update(nonce.to_be_bytes());
    U256::from_be_slice(hasher.finalize().as_slice()).reduce_mod(FIELD_MODULUS)
}

pub fn derive_id(private_key: U256, token_address: Address) -> U256 {
    let mut hasher = sha3::Keccak256::new();
    hasher.update(private_key.to_be_bytes_vec());
    hasher.update(ID_LABEL);
    hasher.update(address_to_u256(token_address).to_be_bytes_vec());
    U256::from_be_slice(hasher.finalize().as_slice()).reduce_mod(FIELD_MODULUS)
}

pub fn generate_id_hiding_nonce() -> U256 {
    let mut rng = OsRng;
    let nonce = rng.gen_range(0..NONCE_UPPER_LIMIT);

    U256::from(nonce)
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use alloy_primitives::{address, U256};
    use halo2curves::{bn256::Fr, ff::PrimeField};

    use super::FIELD_MODULUS;
    use crate::secrets::derive_id;

    #[test]
    pub fn modulus_constant_is_correct() {
        assert_eq!(
            FIELD_MODULUS,
            U256::from_str_radix(Fr::MODULUS.strip_prefix("0x").unwrap(), 16).unwrap()
        );
    }

    #[test]
    pub fn derive_id_is_correct() {
        // Calculated using online tools as the Keccak-256 of the concatenation of:
        //   000000000000000000000000000000000000000000000000000000000000000f (15)
        //   6964 ("id")
        //   000000000000000000000000ffffffffffffffffffffffffffffffffffffffff
        let expected_before_modulo =
            U256::from_str("0x4693e1cf4cbddec0d897bbf2aff897098f5f441732f85cb6442ded2159f3ce68")
                .unwrap();

        let actual = derive_id(
            U256::from(15),
            address!("ffffffffffffffffffffffffffffffffffffffff"),
        );

        assert_ne!(expected_before_modulo, actual);
        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }
}
