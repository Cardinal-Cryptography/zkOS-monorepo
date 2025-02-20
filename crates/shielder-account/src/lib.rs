use std::fmt::Display;

use alloy_primitives::U256;
use halo2curves::bn256::Fr;
use serde::{Deserialize, Serialize};

#[cfg(feature = "contract")]
pub mod call_data;
pub mod secrets;
mod shielder_action;

pub use shielder_action::{ShielderAction, ShielderTxData};
use shielder_circuits::{note_hash, Note};
use shielder_setup::{native_token::NATIVE_TOKEN_ADDRESS, version::contract_version};
use type_conversions::{field_to_u256, u256_to_field};

#[derive(Clone, Eq, Debug, PartialEq, Default, Deserialize, Serialize)]
pub struct ShielderAccount {
    /// The seed used to generate nullifiers and trapdoors. The only secret we need to preserve to
    /// restore the account.
    ///
    /// WARNING: You SHOULD NOT use `Self::Default` in production, as this will set the seed to
    /// zero, which is insecure and might get in conflict with other accounts (similarly set up).
    pub id: U256,
    /// Salt used to generate the MAC for the account.
    pub mac_salt: U256,
    /// The nonce used to generate nullifiers and trapdoors. It is incremented after each action.
    pub nonce: u32,
    /// The total current amount of tokens shielded by the account.
    pub shielded_amount: U256,
    /// The history of actions performed by the account.
    pub history: Vec<ShielderAction>,
}

impl Display for ShielderAccount {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ShielderAccount")
            .field("id", &self.id)
            .field("MAC salt", &self.mac_salt)
            .field("nonce", &self.nonce)
            .field("shielded_amount", &self.shielded_amount)
            .field("current_leaf_index", &self.current_leaf_index())
            .finish()
    }
}

impl ShielderAccount {
    /// Create a new account with the given id. Other fields are initialized to default
    /// values (like the account has no history).
    ///
    /// Note: You SHOULD prefer using `Self::new` instead of `Default::default()`, unless you are
    /// writing single-actor tests.
    pub fn new(id: U256) -> Self {
        Self {
            id,
            ..Default::default()
        }
    }

    /// Save the action in the account history and update the account state.
    pub fn register_action(&mut self, action: impl Into<ShielderAction>) {
        let action = action.into();
        match &action {
            ShielderAction::Deposit(data) | ShielderAction::NewAccount(data) => {
                self.shielded_amount = self
                    .shielded_amount
                    .checked_add(data.amount)
                    .expect("shielded amount overflow");
            }
            ShielderAction::Withdraw { data, .. } => {
                self.shielded_amount = self
                    .shielded_amount
                    .checked_sub(data.amount)
                    .expect("shielded amount underflow");
            }
        }
        self.nonce += 1;
        self.history.push(action);
    }

    /// Get the index of the last leaf in the Merkle tree containing the account's note.
    pub fn current_leaf_index(&self) -> Option<U256> {
        self.history.last().map(|action| match action {
            ShielderAction::NewAccount(data)
            | ShielderAction::Deposit(data)
            | ShielderAction::Withdraw { data, .. } => data.note_index,
        })
    }

    /// Compute note representing current state. `None` if no operations have been performed.
    pub fn note(&self) -> Option<U256> {
        if self.nonce == 0 {
            return None;
        }
        let raw_note: Fr = note_hash(&Note {
            version: contract_version().note_version(),
            id: u256_to_field(self.id),
            nullifier: u256_to_field(self.previous_nullifier()),
            trapdoor: u256_to_field(self.previous_trapdoor().unwrap()), // safe unwrap
            account_balance: u256_to_field(self.shielded_amount),
            token_address: NATIVE_TOKEN_ADDRESS,
        });
        Some(field_to_u256(raw_note))
    }

    /// Generate the nullifier for the next action to be done.
    pub fn next_nullifier(&self) -> U256 {
        secrets::nonced::derive_nullifier(self.id, self.nonce)
    }

    /// Generate the nullifier for the previous action. If the account has no actions, `self.id`
    /// is used as 'pre-nullifier'.
    pub fn previous_nullifier(&self) -> U256 {
        self.nonce.checked_sub(1).map_or(self.id, |nonce| {
            secrets::nonced::derive_nullifier(self.id, nonce)
        })
    }

    /// Generate the trapdoor for the next action to be done.
    pub fn next_trapdoor(&self) -> U256 {
        secrets::nonced::derive_trapdoor(self.id, self.nonce)
    }

    /// Generate the trapdoor for the previous action. If the account has no actions, return `None`.
    pub fn previous_trapdoor(&self) -> Option<U256> {
        self.nonce
            .checked_sub(1)
            .map(|nonce| secrets::nonced::derive_trapdoor(self.id, nonce))
    }
}
