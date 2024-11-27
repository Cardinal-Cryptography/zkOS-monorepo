use alloy_primitives::{Address, TxHash, U256};
use serde::{Deserialize, Serialize};

#[cfg(feature = "contract")]
use crate::contract::ShielderContract::{
    DepositNative, NewAccountNative, ShielderContractEvents, WithdrawNative,
};

#[derive(Clone, Eq, PartialEq, Debug, Deserialize, Serialize)]
pub enum ShielderAction {
    NewAccount(ShielderTxData),
    Deposit(ShielderTxData),
    Withdraw { to: Address, data: ShielderTxData },
}

#[cfg(feature = "contract")]
impl From<(TxHash, ShielderContractEvents)> for ShielderAction {
    fn from((tx_hash, event): (TxHash, ShielderContractEvents)) -> Self {
        match event {
            ShielderContractEvents::NewAccountNative(NewAccountNative {
                amount,
                newNoteIndex,
                ..
            }) => Self::new_account(amount, newNoteIndex, tx_hash),
            ShielderContractEvents::DepositNative(DepositNative {
                amount,
                newNoteIndex,
                ..
            }) => Self::deposit(amount, newNoteIndex, tx_hash),
            ShielderContractEvents::WithdrawNative(WithdrawNative {
                amount,
                withdrawAddress,
                newNoteIndex,
                ..
            }) => Self::withdraw(amount, newNoteIndex, tx_hash, withdrawAddress),
        }
    }
}

impl ShielderAction {
    pub fn new_account(amount: U256, note_index: U256, tx_hash: TxHash) -> Self {
        Self::NewAccount(ShielderTxData {
            amount,
            note_index,
            tx_hash,
        })
    }

    pub fn deposit(amount: U256, note_index: U256, tx_hash: TxHash) -> Self {
        Self::Deposit(ShielderTxData {
            amount,
            note_index,
            tx_hash,
        })
    }

    pub fn withdraw(amount: U256, note_index: U256, tx_hash: TxHash, to: Address) -> Self {
        Self::Withdraw {
            to,
            data: ShielderTxData {
                amount,
                note_index,
                tx_hash,
            },
        }
    }
}

#[derive(Clone, Eq, PartialEq, Debug, Deserialize, Serialize)]
pub struct ShielderTxData {
    pub amount: U256,
    pub note_index: U256,
    pub tx_hash: TxHash,
}
