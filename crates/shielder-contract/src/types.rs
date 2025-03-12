#![allow(clippy::too_many_arguments)]

use core::marker::PhantomData;
use std::fmt::Debug;

use alloy_contract::CallDecoder;
use alloy_primitives::U256;
use alloy_sol_types::{sol, SolCall};
use shielder_setup::{
    shielder_circuits::GrumpkinPointAffine,
    version::{contract_version, ContractVersion},
};
use ShielderContract::*;

use crate::ShielderContractError;

sol! {
    #[sol(rpc, all_derives = true)]
    #[derive(Debug, PartialEq, Eq)]
    contract ShielderContract {
        event NewAccount(
            bytes3 contractVersion,
            uint256 prenullifier,
            address tokenAddress,
            uint256 amount,
            uint256 newNote,
            uint256 newNoteIndex,
        );
        event Deposit(
            bytes3 contractVersion,
            address tokenAddress,
            uint256 amount,
            uint256 newNote,
            uint256 newNoteIndex,
            uint256 macSalt,
            uint256 macCommitment,
        );
        event Withdraw(
            bytes3 contractVersion,
            address tokenAddress,
            uint256 amount,
            address withdrawalAddress,
            uint256 newNote,
            uint256 newNoteIndex,
            address relayerAddress,
            uint256 fee,
            uint256 macSalt,
            uint256 macCommitment,
        );

        error DepositVerificationFailed();
        error DuplicatedNullifier();
        error FeeHigherThanAmount();
        error MerkleRootDoesNotExist();
        error NativeTransferFailed();
        error WithdrawVerificationFailed();
        error NewAccountVerificationFailed();
        error ZeroAmount();
        error AmountOverDepositLimit();
        error AmountTooHigh();
        error ContractBalanceLimitReached();
        error WrongContractVersion(bytes3 actual, bytes3 expectedByCaller);
        error NotAFieldElement();

        function depositLimit() external view returns (uint256);

        function initialize(
            address initialOwner,
            uint256 _depositLimit,
            uint256 _anonymityRevokerPublicKeyX,
            uint256 _anonymityRevokerPublicKeyY,
        ) public;

        function nullifiers(uint256 nullifierHash) public view returns (uint256);

        function pause() external;
        function unpause() external;

        function newAccountNative(
            bytes3 expectedContractVersion,
            uint256 newNote,
            uint256 prenullifier,
            uint256 symKeyEncryptionC1X,
            uint256 symKeyEncryptionC1Y,
            uint256 symKeyEncryptionC2X,
            uint256 symKeyEncryptionC2Y,
            uint256 macSalt,
            uint256 macCommitment,
            bytes calldata proof
        ) external payable whenNotPaused;
        function newAccountERC20(
            bytes3 expectedContractVersion,
            address tokenAddress,
            uint256 amount,
            uint256 newNote,
            uint256 prenullifier,
            uint256 symKeyEncryptionC1X,
            uint256 symKeyEncryptionC1Y,
            uint256 symKeyEncryptionC2X,
            uint256 symKeyEncryptionC2Y,
            uint256 macSalt,
            uint256 macCommitment,
            bytes calldata proof
        ) external whenNotPaused;
        function depositNative(
            bytes3 expectedContractVersion,
            uint256 oldNullifierHash,
            uint256 newNote,
            uint256 merkleRoot,
            uint256 macSalt,
            uint256 macCommitment,
            bytes calldata proof
        ) external payable whenNotPaused;
        function depositERC20(
            bytes3 expectedContractVersion,
            address tokenAddress,
            uint256 amount,
            uint256 oldNullifierHash,
            uint256 newNote,
            uint256 merkleRoot,
            uint256 macSalt,
            uint256 macCommitment,
            bytes calldata proof
        ) external whenNotPaused;
        function withdrawNative(
            bytes3 expectedContractVersion,
            uint256 amount,
            address withdrawalAddress,
            uint256 merkleRoot,
            uint256 oldNullifierHash,
            uint256 newNote,
            bytes calldata proof,
            address relayerAddress,
            uint256 relayerFee,
            uint256 macSalt,
            uint256 macCommitment,
        ) external whenNotPaused;
        function withdrawERC20(
            bytes3 expectedContractVersion,
            address tokenAddress,
            uint256 amount,
            address withdrawalAddress,
            uint256 merkleRoot,
            uint256 oldNullifierHash,
            uint256 newNote,
            bytes calldata proof,
            address relayerAddress,
            uint256 relayerFee,
            uint256 macSalt,
            uint256 macCommitment,
        ) external whenNotPaused;

        function getMerklePath(
            uint256 id
        ) external view returns (uint256[] memory);

        function setDepositLimit(uint256 _depositLimit) external;
        function anonymityRevokerPubkey() public view returns (uint256, uint256);
    }
}

impl ShielderContractEvents {
    pub fn note(&self) -> U256 {
        match self {
            Self::NewAccount(NewAccount { newNote: note, .. })
            | Self::Deposit(Deposit { newNote: note, .. })
            | Self::Withdraw(Withdraw { newNote: note, .. }) => *note,
        }
    }

    pub fn version(&self) -> ContractVersion {
        let version = match self {
            Self::NewAccount(NewAccount {
                contractVersion, ..
            })
            | Self::Deposit(Deposit {
                contractVersion, ..
            })
            | Self::Withdraw(Withdraw {
                contractVersion, ..
            }) => contractVersion,
        };

        ContractVersion::from_bytes(*version)
    }

    pub fn check_version(&self) -> Result<(), ShielderContractError> {
        let version = self.version();
        let sdk_version = contract_version();

        match version == sdk_version {
            true => Ok(()),
            false => Err(ShielderContractError::ContractVersionMismatch {
                version,
                sdk_version,
            }),
        }
    }
}

// This is a workaround for the lack of support for `#[derive(Clone)]` in `sol!` macro.
impl Clone for ShielderContractEvents {
    fn clone(&self) -> Self {
        match self {
            Self::NewAccount(event) => Self::NewAccount(event.clone()),
            Self::Deposit(event) => Self::Deposit(event.clone()),
            Self::Withdraw(event) => Self::Withdraw(event.clone()),
        }
    }
}

pub trait ShielderContractCall: SolCall + Send + Sync {
    type UnwrappedResult: Send + Sync;
    fn unwrap_result(out: <PhantomData<Self> as CallDecoder>::CallOutput) -> Self::UnwrappedResult;
}

macro_rules! impl_unit_call {
    ($call:ident) => {
        impl ShielderContractCall for $call {
            type UnwrappedResult = ();

            fn unwrap_result(
                _: <PhantomData<Self> as CallDecoder>::CallOutput,
            ) -> Self::UnwrappedResult {
            }
        }
    };
}

impl_unit_call!(pauseCall);
impl_unit_call!(unpauseCall);

impl_unit_call!(newAccountNativeCall);
impl_unit_call!(depositNativeCall);
impl_unit_call!(withdrawNativeCall);
impl_unit_call!(newAccountERC20Call);
impl_unit_call!(depositERC20Call);
impl_unit_call!(withdrawERC20Call);

impl ShielderContractCall for getMerklePathCall {
    type UnwrappedResult = Vec<U256>;
    fn unwrap_result(path: getMerklePathReturn) -> Self::UnwrappedResult {
        path._0
    }
}

impl ShielderContractCall for nullifiersCall {
    type UnwrappedResult = U256;
    fn unwrap_result(nullifier: nullifiersReturn) -> Self::UnwrappedResult {
        nullifier._0
    }
}

impl ShielderContractCall for anonymityRevokerPubkeyCall {
    type UnwrappedResult = GrumpkinPointAffine<U256>;
    fn unwrap_result(pubkey: anonymityRevokerPubkeyReturn) -> Self::UnwrappedResult {
        GrumpkinPointAffine {
            x: pubkey._0,
            y: pubkey._1,
        }
    }
}
