use clap::Parser;
use cli::Cli;
use log::info;
use thiserror::Error;

mod cli;
mod generate;
mod revoke;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
enum CliError {
    #[error("Error generating keys")]
    Generator(#[from] generate::GenerateError),
    #[error("Error revoking anonymity")]
    Revoke(#[from] revoke::RevokeError),
}

fn main() -> Result<(), CliError> {
    let config = Cli::parse();
    env_logger::init();

    info!("{:#?}", &config);

    match config.command {
        cli::Command::Generate {
            dir,
            seed,
            endianess,
        } => generate::run(&seed, dir, endianess)?,
        cli::Command::Revoke {
            shielder_address, ..
        } => revoke::run(shielder_address)?,
    }

    Ok(())
}
