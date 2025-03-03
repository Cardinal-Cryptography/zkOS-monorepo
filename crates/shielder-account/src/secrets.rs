use alloy_primitives::{Address, U256};
use rand::{rngs::OsRng, Rng};
use sha3::Digest;
use shielder_circuits::consts::NONCE_UPPER_LIMIT;

pub enum Label {
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

fn hash(label: Label, payload: &[u8]) -> U256 {
    let mut hasher = sha3::Keccak256::new();
    hasher.update(label.as_bytes());
    hasher.update(payload);
    U256::from_be_slice(hasher.finalize().as_slice()).reduce_mod(FIELD_MODULUS)
}

/// Nonce-dependent derivation.
pub mod nonced {
    use alloy_primitives::U256;

    use super::{hash, Label};

    /// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
    pub fn derive_nullifier(id: U256, nonce: u32) -> U256 {
        let mut payload = Vec::new();
        payload.extend(id.to_be_bytes_vec());
        payload.extend_from_slice(&nonce.to_be_bytes());
        hash(Label::Nullifier, &payload)
    }

    /// Returns a pseudorandom field element deterministically computed from `id` and `nonce`.
    pub fn derive_trapdoor(id: U256, nonce: u32) -> U256 {
        let mut payload = Vec::new();
        payload.extend(id.to_be_bytes_vec());
        payload.extend_from_slice(&nonce.to_be_bytes());
        hash(Label::Trapdoor, &payload)
    }
}

/// Private-key-dependent derivation of a per-token private ID.
pub fn derive_id(private_key: U256, chain_id: u64, token_address: Address) -> U256 {
    // Concatenate chain_id bytes and token_address bytes
    let mut payload = Vec::new();
    payload.extend(private_key.to_be_bytes_vec());
    payload.extend_from_slice(&chain_id.to_be_bytes());
    payload.extend_from_slice(token_address.into_word().as_ref());

    hash(Label::Id, &payload)
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
        //   6e756c6c6966696572 ("nullifier")
        //   000000000000000000000000000000000000000000000000000000000000000f
        //   000000ff
        let expected_before_modulo =
            U256::from_str("0x55c10e943627382fd842cfe473e364f44b5d7bedc21d1eab2656b32e2b3e0e3c")
                .unwrap();

        let actual = derive_nullifier(U256::from(15), 0x000000ff);

        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }

    #[test]
    pub fn derive_trapdoor_is_correct() {
        // Calculated using online tools as the Keccak-256 of the concatenation of:
        //   74726170646f6f72 ("trapdoor")
        //   000000000000000000000000000000000000000000000000000000000000000f
        //   000000ef
        let expected_before_modulo =
            U256::from_str("0x1e4afc8f61c8c618e54af25743f3383d855b259e3429480284255e2b9934467a")
                .unwrap();

        let actual = derive_trapdoor(U256::from(15), 0x000000ef);

        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }

    #[test]
    pub fn derive_id_is_correct() {
        // Calculated using online tools as the Keccak-256 of the concatenation of:
        //   6964 ("id")
        //   000000000000000000000000000000000000000000000000000000000000000f
        //   000000000000001a
        //   000000000000000000000000ffffffffffffffffffffffffffffffffffffffff
        let expected_before_modulo =
            U256::from_str("0x16ad3931b096594f5a6ceb8f516d4cda85b3d1e85c9f83f18813259befa0853e")
                .unwrap();

        let actual = derive_id(
            U256::from(15),
            26,
            address!("ffffffffffffffffffffffffffffffffffffffff"),
        );

        assert_eq!(expected_before_modulo.reduce_mod(FIELD_MODULUS), actual)
    }
}
