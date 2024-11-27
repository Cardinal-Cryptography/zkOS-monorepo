use std::{env, fs, path::PathBuf};

pub use evm_runner::{EvmRunner, EvmRunnerError, SuccessResult};
pub use revm_primitives;

pub mod compilation;
mod evm_runner;

fn repo_root_dir() -> PathBuf {
    let mut current_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());

    while current_dir.pop() {
        if let Ok(contents) = fs::read_to_string(current_dir.join("Cargo.toml")) {
            if contents.contains("[workspace]") {
                return current_dir;
            }
        }
    }

    unreachable!("No workspace directory found")
}
