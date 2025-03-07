use std::{
    fs::File,
    io::{self, Write},
    path::PathBuf,
};

use rand::rngs::OsRng;
use shielder_circuits::{generate_keys, le_bits_to_field_element, Fr, GrumpkinPointAffine};
use thiserror::Error;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum GeneratorError {
    #[error("Error writing to stdout")]
    Write(#[from] std::io::Error),
}

pub fn run(dir: PathBuf) -> Result<(), GeneratorError> {
    let mut rng = OsRng;
    let (private_key_bits, public_key) = generate_keys(&mut rng);
    let public_key_affine: GrumpkinPointAffine<Fr> = public_key.into();

    let private_key = le_bits_to_field_element(&private_key_bits);

    let mut file = File::create(format!(
        "{}/{}",
        dir.display().to_string(),
        "/private_key.bin"
    ))?;
    file.write_all(&private_key.to_bytes())?;

    Ok(())
}
