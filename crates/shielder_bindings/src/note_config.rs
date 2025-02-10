use shielder_circuits::consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT};
#[cfg(feature = "build-wasm")]
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-server", macros::jsonize)]
pub fn note_tree_arity() -> u32 {
    ARITY.try_into().unwrap()
}

#[cfg_attr(feature = "build-wasm", wasm_bindgen)]
#[cfg_attr(feature = "build-uniffi", uniffi::export)]
#[cfg_attr(feature = "build-server", macros::jsonize)]
pub fn note_tree_height() -> u32 {
    NOTE_TREE_HEIGHT.try_into().unwrap()
}
