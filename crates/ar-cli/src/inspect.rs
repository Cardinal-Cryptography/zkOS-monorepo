use bip39::{Language, Mnemonic};
use rpassword::read_password;
use type_conversions::field_to_u256;

use crate::{
    common::{deserialize_pub_key, mnemonic_to_seed, seed_to_keypair, serialize_pub_key},
    error::Error,
};

pub fn run_mnemonic() -> Result<(), Error> {
    println!("Enter your 12-word mnemonic phrase:");
    let maybe_mnemonic = read_password()?;
    let mnemonic = Mnemonic::from_phrase(&maybe_mnemonic, Language::English)?;
    let seed = mnemonic_to_seed(&mnemonic);
    let (_private_key, public_key) = seed_to_keypair(&seed);
    let pub_key = serialize_pub_key(public_key);
    println!("seed (secret!!!): {}", hex::encode(seed));
    println!("Public key: {}", hex::encode(pub_key));
    Ok(())
}

pub fn run_pubkey(pk: &[u8; 64]) -> Result<(), Error> {
    let deserialized = deserialize_pub_key(pk)?;
    let (x, y) = pk.split_at(32);
    let x = x.to_vec();
    let y = y.to_vec();
    assert!(x.len() == 32 && y.len() == 32);
    println!("Public key is valid.");
    println!("AR_PUBLIC_KEY=\"{},{}\"", hex::encode(x), hex::encode(y));
    let x_decimal = field_to_u256(deserialized.x);
    let y_decimal = field_to_u256(deserialized.y);
    println!("Decimal coordinates: {} {}", x_decimal, y_decimal);
    Ok(())
}
