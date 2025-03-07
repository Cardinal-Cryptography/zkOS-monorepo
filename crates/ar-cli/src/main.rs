use clap::Parser;
use cli::Cli;
use thiserror::Error;

mod cli;
mod generate;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
enum CliError {
    #[error("Error generating keys")]
    Generator(#[from] generate::GeneratorError),
}

fn main() -> Result<(), CliError> {
    let cli = Cli::parse();

    match cli.command {
        cli::Command::Generate { dir } => generate::run(dir)?,
        cli::Command::Revoke { .. } => todo!(),
    }

    Ok(())
}
