use std::{env, ffi::OsString, path::PathBuf};

use alloy_primitives::Address;
use clap::{builder::ValueParser, Args, Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(name = "ar-cli", version)]
pub struct Cli {
    #[clap(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    /// Generate symmetric encryption keys
    Generate {
        /// Directory where the generated keys are to be written to.
        ///
        /// Existing files will be overwritten!
        #[arg(long, default_value=get_default_dir())]
        dir: PathBuf,

        /// 32-byte hex seed.
        ///
        /// if it contains `0x` prefix it will be stripped.
        /// Example: --seed 3fd54831f488a22b28398de0c567a3b064b937f54f81739ae9bd545967f3abab
        #[arg(long, value_parser = ValueParser::new(parse_32byte_array))]
        seed: [u8; 32],
    },

    InspectMnemonic {
        /// 12-word mnemonic phrase
        #[arg(value_parser)]
        mnemonic: String,
    },

    InspectPubkey {
        /// hex encoded 64-byte public key
        #[arg(value_parser = ValueParser::new(parse_64byte_array))]
        pk: [u8; 64],
    },

    GenerateMnemonic,

    /// Read newAccount on-chain transactions and collect viewing keys
    IndexEvents {
        #[clap(flatten)]
        common: ChainConfig,

        #[clap(long, default_value = "10000")]
        batch_size: usize,

        #[clap(flatten)]
        db: Db,
    },

    /// Read newAccount on-chain transactions and collect viewing keys
    CollectKeys {
        #[clap(flatten)]
        common: ChainConfig,

        #[clap(flatten)]
        db: Db,

        #[arg(long, default_value = "./private_key.bin")]
        private_key_file: PathBuf,

        #[arg(long, default_value = "true")]
        redact_sensitive_data: bool,
    },

    /// Matches everything we have in the db about the identity of the transactions
    Revoke {
        #[clap(flatten)]
        db: Db,
    },

    /// Given a tx-hash reveal all the txs with the same viewing_key
    Reveal {
        #[clap(flatten)]
        db: Db,

        #[arg(long, value_parser = ValueParser::new(parse_32byte_array))]
        tx_hash: [u8; 32],
    },
}

#[derive(Debug, Args)]
pub struct Db {
    #[arg(long, default_value = "./ar_db.db3")]
    pub path: PathBuf,
}

#[derive(Debug, Args)]
pub struct ChainConfig {
    #[arg(long)]
    pub shielder_address: Address,

    #[arg(long, default_value = "http://localhost:8545")]
    pub rpc_url: String,

    #[arg(long, default_value = "0")]
    pub from_block: u64,
}
fn parse_byte_array<const N: usize>(input: &str) -> Result<[u8; N], &'static str> {
    let sanitized_input = input.strip_prefix("0x").unwrap_or(input);
    let mut decoded = [0u8; N];
    if let Err(_why) = hex::decode_to_slice(sanitized_input, &mut decoded) {
        return Err("Error when parsing input value");
    }
    Ok(decoded)
}

fn parse_32byte_array(input: &str) -> Result<[u8; 32], &'static str> {
    parse_byte_array::<32>(input)
}

fn parse_64byte_array(input: &str) -> Result<[u8; 64], &'static str> {
    parse_byte_array::<64>(input)
}

fn get_default_dir() -> OsString {
    env::current_dir().unwrap().into_os_string()
}
