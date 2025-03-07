use std::io::{self, Write};

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

pub fn run() -> Result<(), GeneratorError> {
    let mut rng = OsRng;
    let (private_key_bits, public_key) = generate_keys(&mut rng);
    let public_key_affine: GrumpkinPointAffine<Fr> = public_key.into();

    let private_key = le_bits_to_field_element(&private_key_bits);

    let mut stdout = io::stdout().lock();
    let write = stdout.write_all(&private_key.to_bytes())?;

    Ok(())
}
