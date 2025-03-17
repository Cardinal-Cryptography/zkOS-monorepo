use std::{fs::File, io::Write, path::PathBuf};

use log::{debug, info};
use rand_chacha::{rand_core::SeedableRng, ChaCha12Rng};
use shielder_circuits::{generate_keys, Fr, GrumpkinPointAffine};
use thiserror::Error;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum GeneratorError {
    #[error("Error writing")]
    Write(#[from] std::io::Error),
}

fn spit(dir: &PathBuf, filename: &str, bytes: &[u8]) -> Result<(), std::io::Error> {
    let mut private_key_file = File::create(format!("{}/{}", dir.display().to_string(), filename))?;
    private_key_file.write_all(&bytes)?;
    Ok(())
}

pub fn run(seed: &[u8; 32], dir: PathBuf) -> Result<(), GeneratorError> {
    debug!("Seeding rng with : {seed:?}");

    let mut rng = ChaCha12Rng::from_seed(*seed);

    info!("Generating key pair...");

    let (private_key, public_key) = generate_keys(&mut rng);

    debug!("private key: : {private_key:?}");

    let pubkey @ GrumpkinPointAffine { x, y }: GrumpkinPointAffine<Fr> = public_key.into();
    debug!("public key: : {pubkey:?}");

    spit(&dir, "private_key.bin", &private_key.to_bytes())?;
    spit(&dir, "public_key_x_coord.bin", &x.to_bytes())?;
    spit(&dir, "public_key_y_coord.bin", &y.to_bytes())?;

    info!("key pair files written to {dir:?}");

    Ok(())
}
