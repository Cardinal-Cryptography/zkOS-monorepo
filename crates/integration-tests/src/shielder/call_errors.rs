use alloy_sol_types::{sol, SolInterface};
use shielder_contract::ShielderContract::{self, ShielderContractErrors};

/// An extension of `ShielderContractErrors` that includes all errors that can
/// be triggered by Shielder contract calls during testing, also the ones defined outside Shielder.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ShielderCallErrors {
    DepositVerificationFailed(ShielderContract::DepositVerificationFailed),
    DuplicatedNullifier(ShielderContract::DuplicatedNullifier),
    FeeHigherThanAmount(ShielderContract::FeeHigherThanAmount),
    MerkleRootDoesNotExist(ShielderContract::MerkleRootDoesNotExist),
    NativeTransferFailed(ShielderContract::NativeTransferFailed),
    WithdrawVerificationFailed(ShielderContract::WithdrawVerificationFailed),
    NewAccountVerificationFailed(ShielderContract::NewAccountVerificationFailed),
    ZeroAmount(ShielderContract::ZeroAmount),
    AmountTooHigh(ShielderContract::AmountTooHigh),
    ContractBalanceLimitReached(ShielderContract::ContractBalanceLimitReached),
    WrongContractVersion(ShielderContract::WrongContractVersion),
    NotAFieldElement(ShielderContract::NotAFieldElement),

    InvalidGrumpkinPoint(ShielderContract::InvalidGrumpkinPoint),
    OwnableUnauthorizedAccount(ShielderContract::OwnableUnauthorizedAccount),

    DestinationTriggeredRevert(),
}

impl From<ShielderContractErrors> for ShielderCallErrors {
    fn from(error: ShielderContractErrors) -> Self {
        match error {
            ShielderContractErrors::DepositVerificationFailed(e) => {
                ShielderCallErrors::DepositVerificationFailed(e)
            }
            ShielderContractErrors::DuplicatedNullifier(e) => {
                ShielderCallErrors::DuplicatedNullifier(e)
            }
            ShielderContractErrors::FeeHigherThanAmount(e) => {
                ShielderCallErrors::FeeHigherThanAmount(e)
            }
            ShielderContractErrors::MerkleRootDoesNotExist(e) => {
                ShielderCallErrors::MerkleRootDoesNotExist(e)
            }
            ShielderContractErrors::NativeTransferFailed(e) => {
                ShielderCallErrors::NativeTransferFailed(e)
            }
            ShielderContractErrors::WithdrawVerificationFailed(e) => {
                ShielderCallErrors::WithdrawVerificationFailed(e)
            }
            ShielderContractErrors::NewAccountVerificationFailed(e) => {
                ShielderCallErrors::NewAccountVerificationFailed(e)
            }
            ShielderContractErrors::ZeroAmount(e) => ShielderCallErrors::ZeroAmount(e),
            ShielderContractErrors::AmountTooHigh(e) => ShielderCallErrors::AmountTooHigh(e),
            ShielderContractErrors::ContractBalanceLimitReached(e) => {
                ShielderCallErrors::ContractBalanceLimitReached(e)
            }
            ShielderContractErrors::WrongContractVersion(e) => {
                ShielderCallErrors::WrongContractVersion(e)
            }
            ShielderContractErrors::NotAFieldElement(e) => ShielderCallErrors::NotAFieldElement(e),
            ShielderContractErrors::InvalidGrumpkinPoint(e) => {
                ShielderCallErrors::InvalidGrumpkinPoint(e)
            }
            ShielderContractErrors::OwnableUnauthorizedAccount(e) => {
                ShielderCallErrors::OwnableUnauthorizedAccount(e)
            }
        }
    }
}

sol! {
    #[sol(all_derives = true)]
    #[derive(Debug, PartialEq, Eq)]
    contract RevmTestERC20  {
        error DestinationTriggeredRevert();
    }
}

impl From<RevmTestERC20::RevmTestERC20Errors> for ShielderCallErrors {
    fn from(error: RevmTestERC20::RevmTestERC20Errors) -> Self {
        match error {
            RevmTestERC20::RevmTestERC20Errors::DestinationTriggeredRevert(_) => {
                ShielderCallErrors::DestinationTriggeredRevert()
            }
        }
    }
}

pub fn decode_call_errors(data: &[u8]) -> ShielderCallErrors {
    if let Ok(errors) = ShielderContractErrors::abi_decode(data, true) {
        return errors.into();
    }
    if let Ok(errors) = RevmTestERC20::RevmTestERC20Errors::abi_decode(data, true) {
        return errors.into();
    }
    panic!("Failed to decode Shielder call revert error")
}
