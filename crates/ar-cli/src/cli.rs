use std::{env, ffi::OsString, path::PathBuf};

use clap::{Args, Parser, Subcommand};
// use thiserror::Error;

// #[derive(Debug, Error)]
// #[error(transparent)]
// #[non_exhaustive]
// pub enum CliError {
//     #[error("Error reading default dir")]
//     DefaultDirError(#[from] std::io::Error),
// }

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

fn get_default_dir() -> OsString {
    env::current_dir().unwrap().into_os_string()
}
