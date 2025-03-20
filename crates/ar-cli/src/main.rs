use clap::Parser;
use cli::{Cli, Common};
use log::info;
use thiserror::Error;

mod cli;
mod collect_viewing_keys;
mod db;
mod generate;
mod index_events;
mod revoke;

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
            db,
        } => {
            let connection = db::init(&db.path)?;
            collect_viewing_keys::run(rpc_url, shielder_address, private_key_file, connection)
                .await?
        }
        cli::Command::IndexEvents {
            common:
                Common {
                    rpc_url,
                    shielder_address,
                },
            db,
        } => {
            let connection = db::init(&db.path)?;
            index_events::run(rpc_url, shielder_address, connection).await?
        }
        cli::Command::Revoke { tx_hash } => todo!(),
    }

    Ok(())
}
