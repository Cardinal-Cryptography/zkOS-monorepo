#![cfg_attr(not(any(feature = "build-uniffi", feature = "build-server")), no_std)]

#[cfg(feature = "build-uniffi")]
uniffi::setup_scaffolding!();

#[cfg(feature = "build-server")]
pub use macros_core::EXPORTED_FUNCTIONS;
#[cfg(feature = "multithreading-wasm")]
pub use wasm_bindgen_rayon::init_thread_pool;

extern crate alloc;

pub mod circuits;
pub mod conversions;
pub mod hash;
pub mod note_config;
pub mod secrets;
pub mod utils;
