use std::{env, ffi::OsString, path::PathBuf};

use alloy_primitives::Address;
use clap::{builder::ValueParser, Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(name = "ar-cli", version)]
pub struct Cli {
    #[clap(subcommand)]
    pub command: Command,
}

#[derive(clap::ValueEnum, Clone, Default, Debug)]
pub enum Endianess {
    #[default]
    LitteEndian,
    BigEndian,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Generate {
        /// Directory where the generates keys are to be written to.
        ///
        /// Existing files will be overwritten!
        #[arg(long, default_value=get_default_dir())]
        dir: PathBuf,

        /// 32-byte hex seed.
        ///
        /// Can contain `0x` prefix, which will be stripped.
        /// Example: --seed 3fd54831f488a22b28398de0c567a3b064b937f54f81739ae9bd545967f3abab
        #[arg(long, value_parser = ValueParser::new(parse_hex_as_seed))]
        seed: [u8; 32],

        /// Should the output be produced in the Lower Endian (the default) or Big Endian order?
        #[clap(long, value_enum, default_value_t=Endianess::default())]
        endianess: Endianess,
    },

    Revoke {
        // #[arg(long)]
        // tx_hash: String,
        #[arg(long)]
        shielder_address: Address,

        #[arg(long, default_value = "http://localhost:8545")]
        rpc_url: String,

        #[arg(long, default_value = "./private_key.bin")]
        private_key_file: String,
    },
}

fn parse_hex_as_seed(input: &str) -> Result<[u8; 32], &'static str> {
    let mut decoded = [0u8; 32];

    let sanitized_input = if let Some(stripped) = input.strip_prefix("0x") {
        stripped
    } else {
        input
    };

    if let Err(_why) = hex::decode_to_slice(sanitized_input, &mut decoded) {
        return Err("Error when parsing seed value");
    }
    Ok(decoded)
}

fn get_default_dir() -> OsString {
    env::current_dir().unwrap().into_os_string()
}
