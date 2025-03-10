use std::{env, ffi::OsString, path::PathBuf};

use clap::{builder::ValueParser, Args, Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(name = "ar-cli", version)]
pub struct Cli {
    #[clap(flatten)]
    global_opts: GlobalOpts,

    #[clap(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    Generate {
        #[arg(long, default_value=get_default_dir())]
        dir: PathBuf,

        #[arg(long, value_parser = ValueParser::new(parse_hex_as_seed))]
        seed: [u8; 32],
    },

    Revoke {
        #[arg(long)]
        id: String,
    },
}

#[derive(Debug, Args)]
struct GlobalOpts {
    #[arg(long, default_value = "info")]
    pub rust_log: log::Level,
}

fn parse_hex_as_seed(input: &str) -> Result<[u8; 32], &'static str> {
    let mut decoded = [0u8; 32];
    hex::decode_to_slice(input, &mut decoded).map_err(|err| err.to_string());
    Ok(decoded)
}

fn get_default_dir() -> OsString {
    env::current_dir().unwrap().into_os_string()
}
