use clap::Parser;
use cli::Cli;
use log::info;
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
    let config = Cli::parse();
    env_logger::init();

    info!("{:#?}", &config);

    match config.command {
        cli::Command::Generate { dir, seed } => generate::run(&seed, dir)?,
        cli::Command::Revoke { .. } => todo!(),
    }

    Ok(())
}
