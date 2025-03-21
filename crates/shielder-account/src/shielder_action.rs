use alloy_primitives::{Address, TxHash, U256};
use serde::{Deserialize, Serialize};
#[cfg(feature = "contract")]
use shielder_contract::ShielderContract::{Deposit, NewAccount, ShielderContractEvents, Withdraw};
use shielder_setup::native_token::TokenKind;
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
                tokenAddress,
                ..
            }) => Self::new_account(amount, newNoteIndex, tx_hash, tokenAddress.into()),
            ShielderContractEvents::Deposit(Deposit {
                amount,
                newNoteIndex,
                tokenAddress,
                ..
            }) => Self::deposit(amount, newNoteIndex, tx_hash, tokenAddress.into()),
            ShielderContractEvents::Withdraw(Withdraw {
                amount,
                withdrawalAddress,
                newNoteIndex,
                tokenAddress,
                ..
            }) => Self::withdraw(
                amount,
                newNoteIndex,
                tx_hash,
                withdrawalAddress,
                tokenAddress.into(),
            ),
        }
    }
}

impl ShielderAction {
    pub fn new_account(amount: U256, note_index: U256, tx_hash: TxHash, token: TokenKind) -> Self {
        Self::NewAccount(ShielderTxData {
            amount,
            note_index,
            tx_hash,
            token,
        })
    }

    pub fn deposit(amount: U256, note_index: U256, tx_hash: TxHash, token: TokenKind) -> Self {
        Self::Deposit(ShielderTxData {
            amount,
            note_index,
            tx_hash,
            token,
        })
    }

    pub fn withdraw(
        amount: U256,
        note_index: U256,
        tx_hash: TxHash,
        to: Address,
        token: TokenKind,
    ) -> Self {
        Self::Withdraw {
            to,
            data: ShielderTxData {
                amount,
                note_index,
                tx_hash,
                token,
            },
        }
    }

    pub fn token(&self) -> TokenKind {
        match self {
            Self::NewAccount(data) | Self::Deposit(data) | Self::Withdraw { data, .. } => {
                data.token
            }
        }
    }
}

#[derive(Clone, Eq, PartialEq, Debug, Deserialize, Serialize)]
pub struct ShielderTxData {
    pub amount: U256,
    pub note_index: U256,
    pub tx_hash: TxHash,
    pub token: TokenKind,
}
