use alloy_primitives::{Address, TxHash, U256};
use serde::{Deserialize, Serialize};
#[cfg(feature = "contract")]
use shielder_contract::ShielderContract::{Deposit, NewAccount, ShielderContractEvents, Withdraw};

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
            ShielderContractEvents::NewAccount(NewAccount {
                amount,
                newNoteIndex,
                ..
            }) => Self::new_account(amount, newNoteIndex, tx_hash),
            ShielderContractEvents::Deposit(Deposit {
                amount,
                newNoteIndex,
                ..
            }) => Self::deposit(amount, newNoteIndex, tx_hash),
            ShielderContractEvents::Withdraw(Withdraw {
                amount,
                withdrawalAddress,
                newNoteIndex,
                ..
            }) => Self::withdraw(amount, newNoteIndex, tx_hash, withdrawalAddress),
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
