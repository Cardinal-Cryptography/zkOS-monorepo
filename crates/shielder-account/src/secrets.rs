use alloy_primitives::U256;
use rand::{rngs::OsRng, Rng};
use sha3::Digest;
use shielder_circuits::consts::NONCE_UPPER_LIMIT;

enum Label {
    Nullifier,
    Trapdoor,
    Id,
}

impl Label {
    fn as_bytes(&self) -> &'static [u8] {
        match self {
            Label::Nullifier => b"nullifier",
            Label::Trapdoor => b"trapdoor",
            Label::Id => b"id",
        }
    }
}

// Copied from `src/bn256/fr.rs` in `halo2curves`. Unfortunately only a string constant is public
// in `halo2curves`, and we need bytes for performance reasons.
const FIELD_MODULUS: U256 = U256::from_limbs([
    0x43e1f593f0000001,
    0x2833e84879b97091,
    0xb85045b68181585d,
    0x30644e72e131a029,
]);

fn finalize_hash(hasher: sha3::Keccak256) -> U256 {
    U256::from_be_slice(hasher.finalize().as_slice()).reduce_mod(FIELD_MODULUS)
}

/// Nonce-dependent derivation.
pub mod nonced {
    use alloy_primitives::U256;
    use sha3::Digest;

    use super::{finalize_hash, Label};

    /// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
    pub fn derive_nullifier(id: U256, nonce: u32) -> U256 {
        let mut hasher = sha3::Keccak256::new();
        hasher.update(id.to_be_bytes_vec());
        hasher.update(Label::Nullifier.as_bytes());
        hasher.update(nonce.to_be_bytes());
        finalize_hash(hasher)
    }

    /// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
    pub fn derive_trapdoor(id: U256, nonce: u32) -> U256 {
        let mut hasher = sha3::Keccak256::new();
        hasher.update(id.to_be_bytes_vec());
        hasher.update(Label::Trapdoor.as_bytes());
        hasher.update(nonce.to_be_bytes());
        finalize_hash(hasher)
    }
}

/// Private-key-dependent derivation of a per-chain & per-token account private ID.
pub fn derive_id(private_key: U256, chain_id: u64, account_nonce: u32) -> U256 {
    let mut hasher = sha3::Keccak256::new();
    hasher.update(private_key.to_be_bytes_vec());
    hasher.update(Label::Id.as_bytes());
    hasher.update(chain_id.to_be_bytes());
    hasher.update(account_nonce.to_be_bytes());
    finalize_hash(hasher)
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

    use alloy_primitives::U256;
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
        //   0000000000000000000000000000000000000000000000000000000000000010
        //   6964 ("id")
        //   000000000000001a
        //   0000002d
        let expected_before_modulo =
            U256::from_str("0xf4b3b097dfb3da737872bdf8b59a3b3723345dc147a0b8229608db69cfef6499")
                .unwrap();

        let actual = derive_id(U256::from(16), 26, 45);

        assert_ne!(expected_before_modulo, actual);
        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }
}
