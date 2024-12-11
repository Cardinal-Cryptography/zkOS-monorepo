//! Rust SDK for zkOS Shielder contract.

#[cfg(any(feature = "account", feature = "contract", feature = "conversion"))]
pub use alloy_primitives;

#[cfg(any(feature = "account", feature = "contract", feature = "conversion"))]
pub mod version {
    use alloy_primitives::FixedBytes;
    #[cfg(feature = "account")]
    use shielder_circuits::NoteVersion;

    /// The contract version.
    /// Versioned by note, circuit and patch version.
    #[derive(Clone, Copy, PartialEq, Eq, Debug)]
    pub struct ContractVersion {
        pub note_version: u8,
        pub circuit_version: u8,
        pub patch_version: u8,
    }

    impl ContractVersion {
        pub fn to_bytes(&self) -> FixedBytes<3> {
            FixedBytes([self.note_version, self.circuit_version, self.patch_version])
        }

        pub fn from_bytes(bytes: FixedBytes<3>) -> Self {
            Self {
                note_version: bytes.0[0],
                circuit_version: bytes.0[1],
                patch_version: bytes.0[2],
            }
        }

        #[cfg(feature = "account")]
        pub fn note_version(&self) -> NoteVersion {
            NoteVersion::new(self.note_version)
        }
    }

    /// The contract version. Currently set to 0.0.1
    pub const fn contract_version() -> ContractVersion {
        ContractVersion {
            note_version: 0,
            circuit_version: 0,
            patch_version: 1,
        }
    }
}

pub mod consts {
    pub const ARITY: usize = 7;
    pub const TREE_HEIGHT: usize = 13;

    // Not importing the constants directly to avoid depending on `shielder-circuits` for every
    // feature.
    #[cfg(feature = "account")]
    static_assertions::const_assert_eq!(ARITY, shielder_circuits::consts::merkle_constants::ARITY);
    #[cfg(feature = "account")]
    static_assertions::const_assert_eq!(
        TREE_HEIGHT,
        shielder_circuits::consts::merkle_constants::NOTE_TREE_HEIGHT
    );
}

/// Utilities for interacting with the Shielder contract.
#[cfg(feature = "contract")]
pub mod contract;

/// Utilities for reading in Perpetual Powers of Tau (.ptau) files.
#[cfg(feature = "powers_of_tau")]
pub mod powers_of_tau;

/// Local shielder account management.
#[cfg(feature = "account")]
pub mod account;

#[cfg(feature = "native_token")]
pub mod native_token {
    pub const NATIVE_TOKEN_DECIMALS: u8 = 18;
    pub const ONE_TZERO: u128 = 1_000_000_000_000_000_000;
}

#[cfg(feature = "parameter_generation")]
pub mod parameter_generation {
    use rand::{rngs::SmallRng, RngCore, SeedableRng};

    pub const DEFAULT_SEED: u64 = 42;

    /// A seeded random number generator that MUST be used for any parameter / key generation in any
    /// development context.
    ///
    /// WARNING: Using another RNG will result in different parameters and keys being generated,
    /// which might result in incorrect proofs or failed verification.
    ///
    /// WARNING: You SHOULD NOT use this function multiple times - otherwise you will get the same
    /// values in different contexts.
    pub fn rng() -> impl SeedableRng + RngCore {
        let key = "SHIELDER_RNG_SEED";
        SmallRng::seed_from_u64(
            std::env::var(key)
                .ok()
                .and_then(|val| val.parse::<u64>().ok())
                .unwrap_or_else(|| {
                    println!("WARNING: using a default value seed for generating the SRS string");
                    DEFAULT_SEED
                }),
        )
    }
}

/// Type conversion utilities.
///
/// Contains conversions between:
/// - field element and U256 (both ways): [u256_to_field], [field_to_u256];
/// - field element and raw bytes (both ways): [bytes_to_field], [field_to_bytes];
/// - hex-encoded private key and field element: [private_key_to_field];
/// - raw bytes and U256 (both ways): [bytes_to_u256], [u256_to_bytes];
/// - Ethereum address and field element (both ways): [address_to_field], [field_to_address].
/// - Ethereum address and U256: [address_to_u256].
#[cfg(feature = "conversion")]
pub mod conversion {
    use core::result;
    use std::{borrow::Borrow, str::FromStr};

    use alloy_primitives::{Address, U256};
    use halo2curves::ff::PrimeField;

    #[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
    pub enum Error {
        #[error("incorrect vec length: expected {expected}, got {actual}")]
        IncorrectVecLength { expected: usize, actual: usize },

        #[error("halo2 failed to create field element")]
        Halo2FieldElementCreationFailed,

        #[error("failed to parse hex string to U256")]
        HexU256ParseError,
    }

    pub type Result<T> = result::Result<T, Error>;

    /// Convert a U256 value to a field element.
    pub fn u256_to_field<F: From<[u64; 4]>>(value: impl Borrow<U256>) -> F {
        F::from(*value.borrow().as_limbs())
    }

    /// Convert a field element to a U256 value.
    pub fn field_to_u256<F: PrimeField<Repr = [u8; BYTE_LENGTH]>, const BYTE_LENGTH: usize>(
        value: impl Borrow<F>,
    ) -> U256 {
        U256::from_le_bytes(value.borrow().to_repr())
    }

    /// Convert raw bytes to an array of a fixed length.
    fn byte_vec_to_array<const LENGTH: usize>(bytes: Vec<u8>) -> Result<[u8; LENGTH]> {
        let bytes_len = bytes.len();
        match bytes.try_into() {
            Ok(bytes) => Ok(bytes),
            Err(_) => Err(Error::IncorrectVecLength {
                expected: LENGTH,
                actual: bytes_len,
            }),
        }
    }

    /// Convert raw bytes to a field element.
    pub fn bytes_to_field<F: PrimeField<Repr = [u8; BYTE_LENGTH]>, const BYTE_LENGTH: usize>(
        bytes: Vec<u8>,
    ) -> Result<F> {
        match F::from_repr(byte_vec_to_array::<BYTE_LENGTH>(bytes)?).into() /* conversion from `CtOption<Fr>` */ {
            Some(field_element) => Ok(field_element),
            None => Err(Error::Halo2FieldElementCreationFailed),
        }
    }

    /// Convert a field element to raw bytes.
    pub fn field_to_bytes<F: PrimeField<Repr = [u8; BYTE_LENGTH]>, const BYTE_LENGTH: usize>(
        value: F,
    ) -> Vec<u8> {
        value.to_repr().to_vec()
    }

    /// Since the private key is an arbitrary 32-byte number, this is a non-reversible mapping.
    pub fn private_key_to_field<F: From<[u64; 4]>>(hex: &str) -> Result<F> {
        let u256 = match U256::from_str(hex) {
            Ok(u256) => u256,
            Err(_) => return Err(Error::HexU256ParseError),
        };
        Ok(u256_to_field(u256))
    }

    /// Convert raw bytes to a U256 value.
    pub fn bytes_to_u256(bytes: Vec<u8>) -> Result<U256> {
        Ok(U256::from_le_bytes(byte_vec_to_array::<32>(bytes)?))
    }

    /// Convert a U256 value to raw bytes.
    pub fn u256_to_bytes(value: U256) -> Vec<u8> {
        value.to_le_bytes_vec()
    }

    /// Converts an Ethereum address to a field element. MUST be consistent with the Solidity
    /// implementation, which is `uint256(uint160(address))`.
    pub fn address_to_field<F: From<[u64; 4]>>(address: Address) -> F {
        let mut bytes = [0u8; 32];
        bytes[12..].copy_from_slice(address.as_slice());
        let u256 = U256::from_be_bytes(bytes);
        u256_to_field(u256)
    }

    /// Converts a field element to an Ethereum address. MUST be consistent with the method above.
    pub fn field_to_address<F: PrimeField<Repr = [u8; BYTE_LENGTH]>, const BYTE_LENGTH: usize>(
        address: F,
    ) -> Address {
        let mut bytes = address.to_repr();
        bytes.reverse();
        let mut address = [0u8; 20];
        address.copy_from_slice(&bytes[12..]);
        Address::from(address)
    }

    /// Converts ethereum address into uint256.
    pub fn address_to_u256(address: Address) -> U256 {
        address.into_word().into()
    }

    #[cfg(test)]
    mod tests {
        use alloy_primitives::{address, U256};
        use halo2curves::bn256::Fr;

        use super::*;

        #[test]
        fn between_field_and_u256() {
            let u256 = U256::from(41);
            let field = Fr::from(41);

            // Check that the conversion functions work both ways.
            assert_eq!(u256_to_field::<Fr>(u256), field);
            assert_eq!(field_to_u256(field), u256);

            // Check that the conversion functions are inverses of each other.
            assert_eq!(field_to_u256(u256_to_field::<Fr>(u256)), u256);
            assert_eq!(u256_to_field::<Fr>(field_to_u256(field)), field);
        }

        #[test]
        fn between_field_and_bytes() {
            let bytes = bytes_for_41();
            let field = Fr::from(41);

            // Check that the conversion functions work both ways.
            assert_eq!(bytes_to_field(bytes.clone()), Ok(field));
            assert_eq!(field_to_bytes(field), bytes);

            // Check that the conversion functions are inverses of each other.
            assert_eq!(
                field_to_bytes(bytes_to_field::<Fr, 32>(bytes.clone()).unwrap()),
                bytes
            );
            assert_eq!(bytes_to_field(field_to_bytes(field)), Ok(field));
        }

        #[test]
        fn from_private_key_to_field() {
            let hex = "0x0000000000000000000000000000000000000000000000000000000000000029";
            let field = Fr::from(41);
            assert_eq!(private_key_to_field::<Fr>(hex), Ok(field));
        }

        #[test]
        fn between_bytes_and_u256() {
            let bytes = bytes_for_41();
            let u256 = U256::from(41);

            // Check that the conversion functions work both ways.
            assert_eq!(bytes_to_u256(bytes.clone()), Ok(u256));
            assert_eq!(u256_to_bytes(u256), bytes);

            // Check that the conversion functions are inverses of each other.
            assert_eq!(u256_to_bytes(bytes_to_u256(bytes.clone()).unwrap()), bytes);
            assert_eq!(bytes_to_u256(u256_to_bytes(u256)), Ok(u256));
        }

        #[test]
        fn between_address_and_field() {
            let address = address!("0000000000000000000000000000000000000029");
            let field = Fr::from(41);

            // Check that the conversion functions work both ways.
            assert_eq!(address_to_field::<Fr>(address), field);
            assert_eq!(field_to_address(field), address);

            // Check that the conversion functions are inverses of each other.
            assert_eq!(field_to_address(address_to_field::<Fr>(address)), address);
            assert_eq!(address_to_field::<Fr>(field_to_address(field)), field);
        }

        #[test]
        fn convert_address_to_u256() {
            let address = address!("0000000000000000000000000000000000000029");
            let val = U256::from(41);

            assert_eq!(address_to_u256(address), val);
        }

        fn bytes_for_41() -> Vec<u8> {
            let mut bytes = [0u8; 32];
            bytes[0] = 41u8;
            bytes.to_vec()
        }
    }
}
