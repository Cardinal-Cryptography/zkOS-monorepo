use std::error::Error;

use clap::{Parser, Subcommand};
use halo2_proofs::halo2curves::{bn256::Fr, ff::PrimeField};
use shielder_account::secrets::{nullifier, trapdoor};
use shielder_circuits::{consts::POSEIDON_RATE, poseidon::off_circuit::hash, FieldExt};
use type_conversions::{bytes_to_field, bytes_to_u256};

/// Hashes a variable-length input using const-length Poseidon
fn hash_variable_length<F: FieldExt>(input: &[F]) -> F {
    const RANGE_BOUND: usize = POSEIDON_RATE + 1;

    match input.len() {
        1 => hash::<F, 1>(input.try_into().expect("Safe to unwrap - checked length")),
        2 => hash::<F, 2>(input.try_into().expect("Safe to unwrap - checked length")),
        3 => hash::<F, 3>(input.try_into().expect("Safe to unwrap - checked length")),
        4 => hash::<F, 4>(input.try_into().expect("Safe to unwrap - checked length")),
        5 => hash::<F, 5>(input.try_into().expect("Safe to unwrap - checked length")),
        6 => hash::<F, 6>(input.try_into().expect("Safe to unwrap - checked length")),
        7 => hash::<F, 7>(input.try_into().expect("Safe to unwrap - checked length")),
        0 | RANGE_BOUND.. => panic!(
            "Invalid input length to hash function, expected len between 1 and {}",
            POSEIDON_RATE
        ),
    }
}

#[derive(Parser)]
struct Args {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    PoseidonHashAgreesWithRust {
        #[clap(long, required = true, value_delimiter = ',')]
        hashed_tuple: Vec<u8>,

        #[clap(long, required = true, value_delimiter = ',')]
        expected_hash: Vec<u8>,
    },
    U128EqualsBytes {
        number: u128,
        #[clap(value_delimiter = ',')]
        bytes: Vec<u8>,
    },
    WasmSecretsAgreeWithRust {
        #[clap(long, required = true, value_delimiter = ',')]
        seed: Vec<u8>,

        #[clap(long, required = true)]
        nonce: u32,

        #[clap(long, required = true, value_delimiter = ',')]
        expected_nullifier: Vec<u8>,

        #[clap(long, required = true, value_delimiter = ',')]
        expected_trapdoor: Vec<u8>,
    },
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = Args::parse();
    match args.command {
        Commands::PoseidonHashAgreesWithRust {
            hashed_tuple,
            expected_hash,
        } => {
            assert!(hashed_tuple.len() % 32 == 0);
            let hashed_tuple: Vec<Fr> = hashed_tuple
                .chunks(32)
                .map(|chunk| bytes_to_field(chunk.to_vec()))
                .collect::<Result<Vec<_>, _>>()?;
            let actual_hash = hash_variable_length(&hashed_tuple);

            let expected_hash: Fr = bytes_to_field(expected_hash)?;

            assert_eq!(expected_hash, actual_hash);
        }

        Commands::U128EqualsBytes { number, bytes } => {
            assert_eq!(Fr::from_u128(number), bytes_to_field(bytes)?);
        }

        Commands::WasmSecretsAgreeWithRust {
            seed,
            nonce,
            expected_nullifier,
            expected_trapdoor,
        } => {
            let seed = bytes_to_u256(seed)?;

            let expected_nullifier = bytes_to_u256(expected_nullifier)?;
            let expected_trapdoor = bytes_to_u256(expected_trapdoor)?;

            assert_eq!(expected_nullifier, nullifier(seed, nonce));
            assert_eq!(expected_trapdoor, trapdoor(seed, nonce));
        }
    };
    Ok(())
}
