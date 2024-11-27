use std::{
    fs,
    fs::File,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, bail, Result};
use content_encryption::{decrypt_to_string, encrypt};
use tracing::debug;

use crate::app_state::AppState;

/// Try to get `AppState` from `path`. If `path` describes non-existing file, error will be
/// returned.
///
/// `path` will be decrypted with `password`.
pub fn get_app_state(path: &PathBuf, password: &str) -> Result<AppState> {
    if path.exists() {
        debug!("File with state was found. Reading the state from {path:?}.");
        read_from(path, password)
    } else {
        bail!("File {path:?} with state not found.");
    }
}

/// Save `app_state` to `path`.
///
/// `path` will be encrypted with `password`.
pub fn save_app_state(app_state: &AppState, path: &PathBuf, password: &str) -> Result<()> {
    let serialized =
        serde_json::to_string_pretty(app_state).map_err(|e| anyhow!("Failed to serialize: {e}"))?;
    fs::write(path, encrypt(serialized.as_bytes(), password.as_bytes())?)
        .map_err(|e| anyhow!("Failed to save application state: {e}"))
}

/// Read `AppState` from `path` (decrypting the content with `password`).
fn read_from(path: &Path, password: &str) -> Result<AppState> {
    let file_content = fs::read(path).map_err(|e| anyhow!("Failed to read file content: {e}"))?;
    let decrypted_content = decrypt_to_string(&file_content, password.as_bytes())?;
    serde_json::from_str::<AppState>(&decrypted_content)
        .map_err(|e| anyhow!("Failed to deserialize application state: {e}"))
}

/// Create a new `AppState`, save it to `path` and return it.
pub fn create_and_save_new_state(
    path: &PathBuf,
    password: &str,
    private_key: &str,
) -> Result<AppState> {
    File::create(path).map_err(|e| anyhow!("Failed to create {path:?}: {e}"))?;

    let state = AppState::new(private_key);
    save_app_state(&state, path, password)
        .map_err(|e| anyhow!("Failed to save state to {path:?}: {e}"))?;

    Ok(state)
}
