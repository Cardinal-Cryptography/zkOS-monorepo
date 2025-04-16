use alloy_primitives::keccak256;
use bip39::{Mnemonic, Seed};
use log::debug;
use rand::SeedableRng;
use rand_chacha::ChaCha12Rng;
use shielder_circuits::{generate_keys, grumpkin, Fr, GrumpkinPoint, GrumpkinPointAffine};
use type_conversions::Endianess;

use crate::error::Error;

pub fn serialize_pub_key(pubkey: GrumpkinPoint<Fr>) -> [u8; 64] {
    let GrumpkinPointAffine { x, y }: GrumpkinPointAffine<Fr> = pubkey.into();
    let x_bytes = x.to_bytes_be();
    let y_bytes = y.to_bytes_be();
    let mut bytes = [0u8; 64];
    bytes[0..32].copy_from_slice(&x_bytes);
    bytes[32..64].copy_from_slice(&y_bytes);
    bytes
}

pub fn deserialize_pub_key(bytes: &[u8]) -> Result<GrumpkinPoint<Fr>, Error> {
    if bytes.len() != 64 {
        return Err(Error::DeserializePubKey);
    }
    let x = blob_to_field(&bytes[0..32].iter().rev().copied().collect::<Vec<u8>>())?;
    let y = blob_to_field(&bytes[32..64].iter().rev().copied().collect::<Vec<u8>>())?;
    if y * y != x * x * x - Fr::from(17) {
        return Err(Error::DeserializePubKey);
    }
    Ok(GrumpkinPointAffine::<Fr>::new(x, y).into())
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

pub fn bytes32_to_field(bytes: &[u8; 32]) -> Result<Fr, Error> {
    Fr::from_bytes(bytes)
        .into_option()
        .ok_or(Error::FieldConversion(
            "Failed to convert to Fr".to_string(),
        ))
}

pub fn mnemonic_to_seed(mnemonic: &Mnemonic) -> [u8; 32] {
    let mnemonic_seed = Seed::new(mnemonic, "");
    let mnemonic_seed_bytes: &[u8] = mnemonic_seed.as_bytes();
    // need to hash the seed, because it's 64 bytes, whereas we need 32 bytes to seed the ChaCha12Rng
    let hashed_seed = keccak256(mnemonic_seed_bytes);
    hashed_seed.into()
}

pub fn seed_to_keypair(seed: &[u8; 32]) -> (grumpkin::Fr, GrumpkinPoint<Fr>) {
    debug!("Seeding rng with : {seed:?}");
    let mut rng = ChaCha12Rng::from_seed(*seed);
    generate_keys(&mut rng)
}
