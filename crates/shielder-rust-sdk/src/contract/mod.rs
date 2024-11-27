use alloy_contract::Error;
use alloy_primitives::{keccak256, Address, TxHash, U256};
use alloy_signer_local::LocalSignerError;
use alloy_sol_types::SolValue;
use alloy_transport::TransportError;
pub use api::ShielderUser;
pub use connection::ConnectionPolicy;
pub use types::*;

use crate::{conversion::address_to_u256, version::ContractVersion};

mod api;
pub mod call_type;
mod connection;
pub mod events;
pub mod merkle_path;
pub mod providers;
mod types;

/// Errors that can occur when interacting with the Shielder contract.
#[allow(missing_docs)]
#[derive(Debug, thiserror::Error)]
pub enum ShielderContractError {
    #[error("Couldn't create connection: {0:?}")]
    ProviderError(TransportError),
    #[error("Call failed due to invalid nonce. Probably the signer has just been used in parallel. Please retry.")]
    SignerConflict,
    #[error("Call failed: {0:?}")]
    CallError(Error),
    #[error("Couldn't track the transaction")]
    WatchError,
    #[error("Event was not found for the provided transaction coordinates")]
    EventNotFound,
    #[error("Invalid signer: {0:?}")]
    InvalidSigner(LocalSignerError),
    #[error("Other error: {0}")]
    Other(String),
}

impl From<Error> for ShielderContractError {
    fn from(e: Error) -> Self {
        let e_str = e.to_string();
        if e_str.contains("nonce too low")
            || e_str.contains("transaction already imported")
            || e_str.contains("already known")
        {
            ShielderContractError::SignerConflict
        } else {
            ShielderContractError::CallError(e)
        }
    }
}

impl From<&str> for ShielderContractError {
    fn from(e: &str) -> Self {
        ShielderContractError::Other(e.to_string())
    }
}

type ContractResult<T> = Result<T, ShielderContractError>;
/// Result type for Shielder contract call operations. Contains the transaction hash of the call.
pub type ContractCallResult = ContractResult<TxHash>;
/// Result type for Shielder contract dry run operations. Contains the result of the operation.
pub type ContractDryRunResult<T> = ContractResult<T>;

pub struct WithdrawCommitment {
    pub contract_version: ContractVersion,
    pub withdraw_address: Address,
    pub relayer_address: Address,
    pub relayer_fee: U256,
}

impl WithdrawCommitment {
    pub fn commitment_hash(&self) -> U256 {
        // Same order as in contract
        let hash: U256 = keccak256(
            (
                self.contract_version.to_bytes(),
                address_to_u256(self.withdraw_address),
                address_to_u256(self.relayer_address),
                self.relayer_fee,
            )
                .abi_encode_packed(),
        )
        .into();

        // shifting right by 4 bits, same as in the contract
        hash >> 4
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use alloy_primitives::{Address, U256};
    use halo2curves::ff::PrimeField;
    use rand::{thread_rng, Rng};

    use crate::{contract::WithdrawCommitment, version::ContractVersion};

    fn sample_commitment() -> WithdrawCommitment {
        let mut rng = thread_rng();
        WithdrawCommitment {
            contract_version: ContractVersion {
                note_version: rng.gen(),
                circuit_version: rng.gen(),
                patch_version: rng.gen(),
            },

            withdraw_address: Address::random(),
            relayer_address: Address::random(),
            relayer_fee: rng.gen(),
        }
    }

    #[test]
    fn test_commitment_hash_fit_into_field() {
        const NUMBER_TESTS: usize = 1_000;
        let r = U256::from_str(halo2curves::bn256::Fr::MODULUS).unwrap();

        for _ in 0..NUMBER_TESTS {
            let random_commitment = sample_commitment().commitment_hash();
            assert!(
                random_commitment < r,
                "Failed inequality `{:?}` < `{:?}`",
                random_commitment,
                r
            );
        }
    }
}
