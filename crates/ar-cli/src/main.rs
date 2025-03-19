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

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), CliError> {
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
            rpc_url,
            shielder_address,
            private_key_file,
            ..
        } => revoke::run(&rpc_url, shielder_address, private_key_file).await?,
    }

    Ok(())
}
