//! Solidity verifier generator for [`halo2`] proof with KZG polynomial commitment scheme on BN254.
//!
//! [`halo2`]: http://github.com/privacy-scaling-explorations/halo2

#![deny(missing_docs)]
#![deny(missing_debug_implementations)]
#![deny(rustdoc::broken_intra_doc_links)]

mod codegen;
pub mod verifier_contract;

pub use codegen::{AccumulatorEncoding, BatchOpenScheme, SolidityGenerator};
