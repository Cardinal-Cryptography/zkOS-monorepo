//! Small library for encrypting and decrypting content with a password.

#![deny(missing_docs)]
#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::vec::Vec;

use anyhow::{anyhow, Result};
use chacha20poly1305::{aead::Aead, KeyInit, XChaCha20Poly1305};

const SALT: [u8; 32] = [41u8; 32];
const NONCE: [u8; 24] = [41u8; 24];

fn scheme_from_password(password: &[u8]) -> Result<XChaCha20Poly1305> {
    let key = argon2::hash_raw(password, &SALT, &Default::default())
        .map_err(|e| anyhow!("Failed to derive key from password: {e}"))?;
    Ok(XChaCha20Poly1305::new(key.as_slice().into()))
}

/// Encrypt `content` with `password`.
pub fn encrypt(content: &[u8], password: &[u8]) -> Result<Vec<u8>> {
    scheme_from_password(password)?
        .encrypt(NONCE.as_slice().into(), content)
        .map_err(|e| anyhow!("Failed to encrypt data: {e}"))
}

/// Decrypt `content` with `password`.
pub fn decrypt(content: &[u8], password: &[u8]) -> Result<Vec<u8>> {
    scheme_from_password(password)?
        .decrypt(NONCE.as_slice().into(), content)
        .map_err(|e| anyhow!("Failed to decrypt data - probably the password is incorrect: {e}"))
}

/// Decrypt `content` with `password` and try converting it to `String` right away.
#[cfg(feature = "std")]
pub fn decrypt_to_string(content: &[u8], password: &[u8]) -> Result<String> {
    let decrypted = decrypt(content, password)?;
    String::from_utf8(decrypted)
        .map_err(|e| anyhow!("Failed to decrypt data - probably the password is incorrect: {e}"))
}
