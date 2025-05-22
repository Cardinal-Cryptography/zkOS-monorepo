use std::borrow::Borrow;

use alloy_primitives::U256;
use shielder_circuits::{Fr, PrimeField};

use crate::Error;

/// Convert a U256 value to a field element.
pub fn u256_to_field<Fr: From<[u64; 4]>>(value: impl Borrow<U256>) -> Fr {
    Fr::from(*value.borrow().as_limbs())
}

/// Convert a field element to a U256 value.
pub fn field_to_u256<F: PrimeField<Repr = [u8; BYTE_LENGTH]>, const BYTE_LENGTH: usize>(
    value: impl Borrow<F>,
) -> U256 {
    U256::from_le_bytes(value.borrow().to_repr())
}

pub fn bytes32_to_field(bytes: &[u8; 32]) -> Result<Fr, Error> {
    Fr::from_bytes(bytes)
        .into_option()
        .ok_or(Error::FieldConversion(
            "Failed to convert to Fr".to_string(),
        ))
}

pub fn blob_to_field(blob: &[u8]) -> Result<Fr, Error> {
    if blob.len() != 32 {
        return Err(Error::FieldConversion(format!(
            "Expected 32 bytes, but got {} bytes",
            blob.len()
        )));
    }

    let bytes: [u8; 32] = blob
        .try_into()
        .map_err(|_| Error::FieldConversion("Failed to convert &[u8] to [u8; 32]".to_string()))?;

    bytes32_to_field(&bytes)
}
