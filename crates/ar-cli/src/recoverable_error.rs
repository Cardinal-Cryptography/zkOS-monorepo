use alloy_json_rpc::RpcError;
use alloy_transport::TransportErrorKind;
use hex::FromHexError;
use shielder_contract::ShielderContractError;
use thiserror::Error;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum MaybeRecoverableError {
    #[error("Error while interacting with the Shielder contract")]
    Contract(#[from] ShielderContractError),

    #[error("RPC error")]
    Rpc(#[from] RpcError<TransportErrorKind>),

    #[error("Hex decoding error")]
    HexError(#[from] FromHexError),

    #[error("Error reading AR private key file")]
    ARKeyRead(#[from] std::io::Error),

    #[error("Error converting from a little-endian byte representation to grumpkin::Fr")]
    NotAGrumpkinBaseFieldElement,

    #[error("Error while persisting data")]
    Db(#[from] rusqlite::Error),

    #[error("Error while decoding event log")]
    EventLog(#[from] alloy_sol_types::Error),

    #[error("Event is missing some data")]
    MissingData,
}
