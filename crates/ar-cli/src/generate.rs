use std::{fs::File, io::Write, path::PathBuf};

use endianess::Endianess;
use log::{debug, info};
use rand_chacha::{rand_core::SeedableRng, ChaCha12Rng};
use shielder_circuits::{generate_keys, Fr, GrumpkinPointAffine};
use thiserror::Error;

use crate::cli::{self};

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum GeneratorError {
    #[error("Error writing")]
    Write(#[from] std::io::Error),
}

mod endianess {

    use shielder_circuits::PrimeField;

    pub trait Endianess {
        fn to_bytes_le(&self) -> [u8; 32];
        fn to_bytes_be(&self) -> [u8; 32];
        #[cfg(test)]
        fn from_bytes_be(be_bytes: [u8; 32]) -> Self;
        #[cfg(test)]
        fn from_bytes_le(be_bytes: [u8; 32]) -> Self;
    }

    impl<T> Endianess for T
    where
        T: PrimeField<Repr = [u8; 32]>,
    {
        fn to_bytes_le(&self) -> [u8; 32] {
            self.to_repr()
        }
        fn to_bytes_be(&self) -> [u8; 32] {
            let mut bytes = self.to_bytes_le();
            bytes.reverse();
            bytes
        }
        #[cfg(test)]
        fn from_bytes_be(be_bytes: [u8; 32]) -> Self {
            let mut le_bytes = be_bytes;
            le_bytes.reverse();
            Self::from_repr(le_bytes).expect("not a BE representation")
        }
        #[cfg(test)]
        fn from_bytes_le(le_bytes: [u8; 32]) -> Self {
            Self::from_repr(le_bytes).expect("not a LE representation")
        }
    }

    #[cfg(test)]
    mod tests {
        use shielder_circuits::{grumpkin, Fr, PrimeField};

        use super::Endianess;

        #[test]
        fn bn254_fr_test() {
            let element = Fr::from_u128(7);

            let bytes_be = element.to_bytes_be();
            assert_eq!(element, Endianess::from_bytes_be(bytes_be));

            let bytes_le = element.to_bytes_le();
            assert_eq!(element, Endianess::from_bytes_le(bytes_le));
        }

        #[test]
        fn grumpkin_fr_test() {
            let element = grumpkin::Fr::from_u128(7);

            let bytes_be = element.to_bytes_be();
            assert_eq!(element, Endianess::from_bytes_be(bytes_be));

            let bytes_le = element.to_bytes_le();
            assert_eq!(element, Endianess::from_bytes_le(bytes_le));
        }
    }
}

fn spit(dir: &PathBuf, filename: &str, bytes: &[u8]) -> Result<(), std::io::Error> {
    let mut private_key_file = File::create(format!("{}/{}", dir.display().to_string(), filename))?;
    private_key_file.write_all(&bytes)?;
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
