//! Rust SDK for zkOS Shielder contract.

#[cfg(any(feature = "account", feature = "contract"))]
pub use alloy_primitives;

#[cfg(any(feature = "account", feature = "contract"))]
pub mod version {
    use alloy_primitives::FixedBytes;
    #[cfg(feature = "account")]
    use shielder_circuits::NoteVersion;

    /// The contract version.
    /// Versioned by note, circuit and patch version.
    #[derive(Clone, Copy, PartialEq, Eq, Debug)]
    pub struct ContractVersion {
        pub note_version: u8,
        pub circuit_version: u8,
        pub patch_version: u8,
    }

    impl ContractVersion {
        pub fn to_bytes(&self) -> FixedBytes<3> {
            FixedBytes([self.note_version, self.circuit_version, self.patch_version])
        }

        pub fn from_bytes(bytes: FixedBytes<3>) -> Self {
            Self {
                note_version: bytes.0[0],
                circuit_version: bytes.0[1],
                patch_version: bytes.0[2],
            }
        }

        #[cfg(feature = "account")]
        pub fn note_version(&self) -> NoteVersion {
            NoteVersion::new(self.note_version)
        }
    }

    /// The contract version. Currently set to 0.0.1
    pub const fn contract_version() -> ContractVersion {
        ContractVersion {
            note_version: 0,
            circuit_version: 0,
            patch_version: 1,
        }
    }
}

pub mod consts {
    pub const ARITY: usize = 7;
    pub const TREE_HEIGHT: usize = 13;

    // Not importing the constants directly to avoid depending on `shielder-circuits` for every
    // feature.
    #[cfg(feature = "account")]
    static_assertions::const_assert_eq!(ARITY, shielder_circuits::consts::merkle_constants::ARITY);
    #[cfg(feature = "account")]
    static_assertions::const_assert_eq!(
        TREE_HEIGHT,
        shielder_circuits::consts::merkle_constants::NOTE_TREE_HEIGHT
    );
}

/// Utilities for interacting with the Shielder contract.
#[cfg(feature = "contract")]
pub mod contract;

/// Local shielder account management.
#[cfg(feature = "account")]
pub mod account;

#[cfg(feature = "native_token")]
pub mod native_token {
    pub const NATIVE_TOKEN_DECIMALS: u8 = 18;
    pub const ONE_TZERO: u128 = 1_000_000_000_000_000_000;
}

#[cfg(feature = "parameter_generation")]
pub mod parameter_generation {
    use rand::{rngs::SmallRng, RngCore, SeedableRng};

    pub const DEFAULT_SEED: u64 = 42;

    /// A seeded random number generator that MUST be used for any parameter / key generation in any
    /// development context.
    ///
    /// WARNING: Using another RNG will result in different parameters and keys being generated,
    /// which might result in incorrect proofs or failed verification.
    ///
    /// WARNING: You SHOULD NOT use this function multiple times - otherwise you will get the same
    /// values in different contexts.
    pub fn rng() -> impl SeedableRng + RngCore {
        let key = "SHIELDER_RNG_SEED";
        SmallRng::seed_from_u64(
            std::env::var(key)
                .ok()
                .and_then(|val| val.parse::<u64>().ok())
                .unwrap_or_else(|| {
                    println!("WARNING: using a default value seed for generating the SRS string");
                    DEFAULT_SEED
                }),
        )
    }
}
