use std::{
    fs::File,
    io::Write,
    path::{Path, PathBuf},
};

use log::{debug, info};
use rand_chacha::{rand_core::SeedableRng, ChaCha12Rng};
use shielder_circuits::{generate_keys, Fr, GrumpkinPointAffine};
use thiserror::Error;
use type_conversions::Endianess;

use crate::cli::{self};

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum GeneratorError {
    #[error("Error writing")]
    Write(#[from] std::io::Error),
}

fn spit(dir: &Path, filename: &str, bytes: &[u8]) -> Result<(), std::io::Error> {
    let mut private_key_file = File::create(format!("{}/{}", dir.display(), filename))?;
    private_key_file.write_all(bytes)?;
    Ok(())
}

pub fn run(seed: &[u8; 32], dir: PathBuf, endianess: cli::Endianess) -> Result<(), GeneratorError> {
    debug!("Seeding rng with : {seed:?}");

    let mut rng = ChaCha12Rng::from_seed(*seed);

    info!("Generating key pair...");

    let (private_key, public_key) = generate_keys(&mut rng);

    debug!("private key: : {private_key:?}");

    let pubkey @ GrumpkinPointAffine { x, y }: GrumpkinPointAffine<Fr> = public_key.into();
    debug!("public key: : {pubkey:?}");

    let (private_key_bytes, x_bytes, y_bytes) = match endianess {
        cli::Endianess::BigEndian => (private_key.to_bytes_be(), x.to_bytes_be(), y.to_bytes_be()),
        cli::Endianess::LitteEndian => {
            (private_key.to_bytes_le(), x.to_bytes_le(), y.to_bytes_le())
        }
    };

    spit(&dir, "private_key.bin", &private_key_bytes)?;
    spit(&dir, "public_key_x_coord.bin", &x_bytes)?;
    spit(&dir, "public_key_y_coord.bin", &y_bytes)?;

    info!("key pair files written to {dir:?}");

    Ok(())
}
