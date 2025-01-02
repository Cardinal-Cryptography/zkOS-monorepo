#![allow(clippy::too_many_arguments)]

use core::marker::PhantomData;
use std::fmt::Debug;

use alloy_contract::CallDecoder;
use alloy_primitives::U256;
use alloy_sol_types::{sol, SolCall};
use ShielderContract::*;

use crate::{
    contract::ShielderContractError,
    version::{contract_version, ContractVersion},
};

sol! {
    #[sol(rpc, all_derives = true)]
    #[derive(Debug, PartialEq, Eq)]
    contract ShielderContract {
        event NewAccountNative(
            bytes3 contractVersion,
            uint256 idHash,
            uint256 amount,
            uint256 newNote,
            uint256 newNoteIndex
        );
        event DepositNative(
            bytes3 contractVersion,
            uint256 idHiding,
            uint256 amount,
            uint256 newNote,
            uint256 newNoteIndex
        );
        event WithdrawNative(
            bytes3 contractVersion,
            uint256 idHiding,
            uint256 amount,
            address withdrawAddress,
            uint256 newNote,
            uint256 newNoteIndex,
            address relayerAddress,
            uint256 fee,
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
        error LeafIsNotInTheTree();
        error PrecompileCallFailed();
        error WrongContractVersion(bytes3 actual, bytes3 expectedByCaller);
        error NotAFieldElement();

        function depositLimit() external view returns (uint256);

        function initialize(
            address initialOwner,
            uint256 _depositLimit
        ) public;

        function nullifiers(uint256 nullifierHash) public view returns (uint256);

        function pause() external;
        function unpause() external;

        function newAccountNative(
            bytes3 expectedContractVersion,
            uint256 newNote,
            uint256 idHash,
            bytes calldata proof
        ) external payable;
        function depositNative(
            bytes3 expectedContractVersion,
            uint256 idHiding,
            uint256 oldNullifierHash,
            uint256 newNote,
            uint256 merkleRoot,
            bytes calldata proof,
        ) external payable;
        function withdrawNative(
            bytes3 expectedContractVersion,
            uint256 idHiding,
            uint256 amount,
            address withdrawAddress,
            uint256 merkleRoot,
            uint256 oldNullifierHash,
            uint256 newNote,
            bytes calldata proof,
            address relayerAddress,
            uint256 relayerFee,
        ) external;

        function newAccountToken(
            address tokenOwner,
            address token,
            uint256 amount,
            uint256 nonce,
            uint256 deadline,
            bytes calldata signature
        ) external;

        function depositToken(
            address tokenOwner,
            address token,
            uint256 amount,
            uint256 nonce,
            uint256 deadline,
            bytes calldata signature
        ) external;

        function withdrawToken(
            address token,
            uint256 amount,
            address withdrawAddress,
            address relayerAddress,
            uint256 relayerFee
        ) external;

        function getMerklePath(
            uint256 id
        ) external view returns (uint256[] memory);

        function setDepositLimit(uint256 _depositLimit) external;
    }
}

impl ShielderContractEvents {
    pub fn note(&self) -> U256 {
        match self {
            Self::NewAccountNative(NewAccountNative { newNote: note, .. })
            | Self::DepositNative(DepositNative { newNote: note, .. })
            | Self::WithdrawNative(WithdrawNative { newNote: note, .. }) => *note,
        }
    }

    pub fn version(&self) -> ContractVersion {
        let version = match self {
            Self::NewAccountNative(NewAccountNative {
                contractVersion, ..
            })
            | Self::DepositNative(DepositNative {
                contractVersion, ..
            })
            | Self::WithdrawNative(WithdrawNative {
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
            Self::NewAccountNative(event) => Self::NewAccountNative(event.clone()),
            Self::DepositNative(event) => Self::DepositNative(event.clone()),
            Self::WithdrawNative(event) => Self::WithdrawNative(event.clone()),
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
