#![cfg_attr(not(feature = "build-uniffi"), no_std)]

#[cfg(feature = "build-uniffi")]
uniffi::setup_scaffolding!();

#[cfg(feature = "multithreading-wasm")]
pub use wasm_bindgen_rayon::init_thread_pool;

extern crate alloc;

pub mod circuits;
pub mod hash;
pub mod note_config;
pub mod secrets;
pub mod utils;
