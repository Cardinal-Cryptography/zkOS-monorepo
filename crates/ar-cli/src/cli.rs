use clap::{Args, Parser, Subcommand};

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
        // #[arg(long)]
        // path: String,
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
