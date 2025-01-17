//! Rust SDK for zkOS Shielder contract.

#[cfg(any(feature = "account", feature = "contract"))]
pub use alloy_primitives;

/// Utilities for interacting with the Shielder contract.
#[cfg(feature = "contract")]
pub mod contract;

/// Local shielder account management.
#[cfg(feature = "account")]
pub mod account;
