use clap::Parser;
use cli::{Cli, Common};
use log::info;
use thiserror::Error;

mod cli;
mod collect_viewing_keys;
mod db;
mod generate;
mod index_events;
mod reveal;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
enum CliError {
    #[error("Error generating keys")]
    Generate(#[from] generate::GenerateError),

    #[error("Error revoking anonymity")]
    Revoke(#[from] collect_viewing_keys::CollectKeysError),

    #[error("Error indexing events")]
    Index(#[from] index_events::IndexEventsError),

    #[error("Db Error")]
    Db(#[from] rusqlite::Error),
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), CliError> {
    let config = Cli::parse();
    env_logger::init();

    info!("{:#?}", &config);

    if let cli::Command::IndexEvents { db, .. } | cli::Command::CollectKeys { db, .. } =
        &config.command
    {
        db::init(&db.path)?;
    }

    match &config.command {
        cli::Command::Generate {
            dir,
            seed,
            endianess,
        } => generate::run(seed, dir, endianess)?,
        cli::Command::CollectKeys {
            private_key_file,
            common:
                Common {
                    rpc_url,
                    shielder_address,
                },
            ..
        } => collect_viewing_keys::run(rpc_url, shielder_address, private_key_file).await?,
        cli::Command::IndexEvents {
            common:
                Common {
                    rpc_url,
                    shielder_address,
                },
            ..
        } => index_events::run(rpc_url, shielder_address).await?,
    }

    Ok(())
}
