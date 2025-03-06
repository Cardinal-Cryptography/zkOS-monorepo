use clap::Parser;
use cli::Cli;

mod cli;
mod generate;

fn main() {
    let cli = Cli::parse();

    match cli.command {
        cli::Command::Generate { path } => generate::run(),
        cli::Command::Revoke { id } => todo!(),
    }
}
