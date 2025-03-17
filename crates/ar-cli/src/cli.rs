use std::{env, ffi::OsString, path::PathBuf};

use clap::{builder::ValueParser, Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(name = "ar-cli", version)]
pub struct Cli {
    #[clap(subcommand)]
    pub command: Command,
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
    },

    Revoke {
        #[arg(long)]
        id: String,
    },
}

fn parse_hex_as_seed(input: &str) -> Result<[u8; 32], &'static str> {
    let mut decoded = [0u8; 32];

    let sanitized_input = if input.starts_with("0x") {
        &input[2..]
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
