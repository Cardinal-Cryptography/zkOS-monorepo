use bip39::{Language, Mnemonic};

use crate::{common::{deserialize_pub_key, mnemonic_to_seed, seed_to_keypair, serialize_pub_key}, error::Error};




pub fn run_mnemonic(maybe_mnemonic: &str) -> Result<(), Error> {
    let mnemonic = Mnemonic::from_phrase(maybe_mnemonic, Language::English)?;
    let seed = mnemonic_to_seed(&mnemonic);
    let (_private_key, public_key) = seed_to_keypair(&seed);
    let pub_key = serialize_pub_key(public_key);
    println!("seed (secret!!!): {}", hex::encode(seed));
    println!("Public key: {}", hex::encode(pub_key));
    Ok(())
}



pub fn run_pubkey(pk: &[u8;64]) -> Result<(), Error> {
    let _deserialized = deserialize_pub_key(pk)?;
    let (x, y) = pk.split_at(32);
    let x = x.to_vec();
    let y = y.to_vec();
    assert!(x.len() == 32 && y.len() == 32);
    println!("Public key is valid.");
    println!("AR_PUBLIC_KEY=\"{},{}\"", hex::encode(x), hex::encode(y));
    Ok(())
}