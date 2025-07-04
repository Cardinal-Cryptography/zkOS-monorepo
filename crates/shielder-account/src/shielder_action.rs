use alloy_primitives::{Address, TxHash, U256};
use serde::{Deserialize, Serialize};
#[cfg(feature = "contract")]
use shielder_contract::ShielderContract::{Deposit, NewAccount, ShielderContractEvents, Withdraw};

use crate::Token;

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
                protocolFee,
                ..
            }) => Self::new_account(
                amount,
                newNoteIndex,
                tx_hash,
                tokenAddress.into(),
                protocolFee,
            ),
            ShielderContractEvents::Deposit(Deposit {
                amount,
                newNoteIndex,
                tokenAddress,
                protocolFee,
                ..
            }) => Self::deposit(
                amount,
                newNoteIndex,
                tx_hash,
                tokenAddress.into(),
                protocolFee,
            ),
            ShielderContractEvents::Withdraw(Withdraw {
                amount,
                withdrawalAddress,
                newNoteIndex,
                tokenAddress,
                protocolFee,
                ..
            }) => Self::withdraw(
                amount,
                newNoteIndex,
                tx_hash,
                withdrawalAddress,
                tokenAddress.into(),
                protocolFee,
            ),
        }
    }
}

impl ShielderAction {
    pub fn new_account(
        amount: U256,
        note_index: U256,
        tx_hash: TxHash,
        token: Token,
        protocol_fee: U256,
    ) -> Self {
        Self::NewAccount(ShielderTxData {
            amount,
            note_index,
            tx_hash,
            token,
            protocol_fee,
        })
    }

    pub fn deposit(
        amount: U256,
        note_index: U256,
        tx_hash: TxHash,
        token: Token,
        protocol_fee: U256,
    ) -> Self {
        Self::Deposit(ShielderTxData {
            amount,
            note_index,
            tx_hash,
            token,
            protocol_fee,
        })
    }

    pub fn withdraw(
        amount: U256,
        note_index: U256,
        tx_hash: TxHash,
        to: Address,
        token: Token,
        protocol_fee: U256,
    ) -> Self {
        Self::Withdraw {
            to,
            data: ShielderTxData {
                amount,
                note_index,
                tx_hash,
                token,
                protocol_fee,
            },
        }
    }

    pub fn token(&self) -> Token {
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
    pub token: Token,
    pub protocol_fee: U256,
}
