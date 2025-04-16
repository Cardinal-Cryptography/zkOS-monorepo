use std::{
    fs::File,
    io::Write,
    path::{Path, PathBuf},
};

use bip39::{Language, Mnemonic, MnemonicType};
use log::debug;
use type_conversions::{field_to_u256, Endianess};

use crate::{
    common::{mnemonic_to_seed, seed_to_keypair, serialize_pub_key},
    error::Error,
};

fn spit(dir: &Path, filename: &str, bytes: &[u8]) -> Result<(), std::io::Error> {
    let mut private_key_file = File::create(format!("{}/{}", dir.display(), filename))?;
    private_key_file.write_all(bytes)?;
    Ok(())
}

pub fn run_gen_from_seed(seed: &[u8; 32], dir: &PathBuf) -> Result<(), Error> {
    run_inner(seed, Some(dir))
}

fn run_inner(seed: &[u8; 32], dir: Option<&PathBuf>) -> Result<(), Error> {
    let (private_key, public_key) = seed_to_keypair(seed);
    debug!(
        "private key: : {private_key:?} [{}]",
        field_to_u256(private_key)
    );
    let public_key_bytes = serialize_pub_key(public_key);
    let hex_pub_key = hex::encode(public_key_bytes);
    println!("Public key: {}", hex_pub_key);
    if let Some(dir) = dir {
            let private_key_bytes = private_key.to_bytes_be();
            spit(dir, "private_key.bin", &private_key_bytes)?;
            spit(dir, "public_key.bin", &public_key_bytes)?;
            println!("key pair files written to {dir:?}");
    }
    Ok(())
}

pub fn run_gen_mnemonic() -> Result<(), Error> {
    let mnemonic = Mnemonic::new(MnemonicType::Words12, Language::English);
    let phrase: &str = mnemonic.phrase();
    println!("mnemonic phrase: {}", phrase);
    let seed_bytes = mnemonic_to_seed(&mnemonic);
    println!("seed bytes: {}", hex::encode(seed_bytes));
    run_inner(&seed_bytes, None)
}
