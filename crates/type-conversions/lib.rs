//! Type conversion utilities.
//!
//! Contains conversions between:
//! - field element and U256 (both ways): [u256_to_field], [field_to_u256];
//! - field element and raw bytes (both ways): [bytes_to_field], [field_to_bytes];
//! - hex string and U256: [hex_to_u256];
//! - raw bytes and U256 (both ways): [bytes_to_u256], [u256_to_bytes];
//! - Ethereum address and field element (both ways): [address_to_field], [field_to_address].
//! - Ethereum address and U256: [address_to_u256].
use core::result;
use std::{borrow::Borrow, str::FromStr};

use alloy_primitives::{Address, U256};
use halo2curves::ff::PrimeField;

mod endianess;

pub use endianess::Endianess;

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
pub fn hex_32_to_f<F: From<[u64; 4]>>(hex: &str) -> Result<F> {
    let u256 = hex_to_u256(hex)?;
    Ok(u256_to_field(u256))
}

/// Convert a hex string (with "0x" prefix) to U256.
pub fn hex_to_u256(hex: &str) -> Result<U256> {
    U256::from_str(hex).map_err(|_| Error::HexU256ParseError)
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
    fn from_hex_to_u256() {
        let hex = "0x0000000000000000000000000000000000000000000000000000000000000029";
        let u256 = U256::from(41);
        assert_eq!(hex_to_u256(hex), Ok(u256));
    }

    #[test]
    fn from_hex_32_to_to_field() {
        let hex = "0x0000000000000000000000000000000000000000000000000000000000000029";
        let field = Fr::from(41);
        assert_eq!(hex_32_to_f::<Fr>(hex), Ok(field));
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
