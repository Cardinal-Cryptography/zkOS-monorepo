use alloy_primitives::U256;
use thiserror::Error;

pub mod crypto;
pub mod rewards;

#[derive(Clone, Debug)]
pub struct ShielderTransaction {
    pub value: U256,
    pub mac_salt: U256,
    pub mac_commitment: U256,
}

#[derive(Clone, Debug)]

pub struct AppState {
    pub txs: Vec<ShielderTransaction>,
}

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum Error {
    #[error("Error reading AR private key file")]
    ARKeyRead(#[from] std::io::Error),

    #[error("Error converting from a little-endian byte representation to grumpkin::Fr")]
    NotAGrumpkinBaseFieldElement,

    #[error("Event is missing some data")]
    MissingData,

    #[error("Field conversion")]
    FieldConversion(String),

    #[error("Error while deserializing public key")]
    DeserializePubKey,

    #[error("Public key does not satisfy y^2 = x^3 - 17")]
    PubkeyNotOnCurve,
}
