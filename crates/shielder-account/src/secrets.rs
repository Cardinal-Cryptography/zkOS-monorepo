use alloy_primitives::{Address, U256};
use rand::{rngs::OsRng, Rng};
use sha3::Digest;
use shielder_circuits::consts::NONCE_UPPER_LIMIT;

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

fn hash(id: U256, label: &[u8], payload: &[u8]) -> U256 {
    let mut hasher = sha3::Keccak256::new();
    hasher.update(id.to_be_bytes_vec());
    hasher.update(label);
    hasher.update(payload);
    U256::from_be_slice(hasher.finalize().as_slice()).reduce_mod(FIELD_MODULUS)
}

/// Nonce-dependent derivation.
pub mod nonced {
    use alloy_primitives::U256;

    use super::{hash, NULLIFIER_LABEL, TRAPDOOR_LABEL};

    /// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
    pub fn derive_nullifier(id: U256, nonce: u32) -> U256 {
        hash(id, NULLIFIER_LABEL, &nonce.to_be_bytes())
    }

    /// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
    pub fn derive_trapdoor(id: U256, nonce: u32) -> U256 {
        hash(id, TRAPDOOR_LABEL, &nonce.to_be_bytes())
    }
}

/// Private-key-dependent derivation of a per-token private ID.
pub fn derive_id(private_key: U256, token_address: Address) -> U256 {
    hash(private_key, ID_LABEL, token_address.into_word().as_ref())
}

/// Random generation of a nonce for ID hiding.
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

    use crate::secrets::{
        derive_id,
        nonced::{derive_nullifier, derive_trapdoor},
        FIELD_MODULUS,
    };

    #[test]
    pub fn modulus_constant_is_correct() {
        assert_eq!(
            FIELD_MODULUS,
            U256::from_str_radix(Fr::MODULUS.strip_prefix("0x").unwrap(), 16).unwrap()
        );
    }

    #[test]
    pub fn derive_nullifier_is_correct() {
        // Calculated using online tools as the Keccak-256 of the concatenation of:
        //   000000000000000000000000000000000000000000000000000000000000000f
        //   6e756c6c6966696572 ("nullifier")
        //   000000ff
        let expected_before_modulo =
            U256::from_str("0x375a07a9503d15a291307e33ad0c297c9768fea4712947172ad09f2df34d8015")
                .unwrap();

        let actual = derive_nullifier(U256::from(15), 0x000000ff);

        assert_ne!(expected_before_modulo, actual);
        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }

    #[test]
    pub fn derive_trapdoor_is_correct() {
        // Calculated using online tools as the Keccak-256 of the concatenation of:
        //   000000000000000000000000000000000000000000000000000000000000000f
        //   74726170646f6f72 ("trapdoor")
        //   000000ef
        let expected_before_modulo =
            U256::from_str("0x878855043883a06951384006c159237f0df9a2c6ede19441f7bfaf1b4ff517b1")
                .unwrap();

        let actual = derive_trapdoor(U256::from(15), 0x000000ef);

        assert_ne!(expected_before_modulo, actual);
        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }

    #[test]
    pub fn derive_id_is_correct() {
        // Calculated using online tools as the Keccak-256 of the concatenation of:
        //   000000000000000000000000000000000000000000000000000000000000000f
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
