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
mod revoke;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
enum CliError {
    #[error("Error generating keys")]
    Generate(#[from] generate::GenerateError),

    #[error("Error collecting viewing keys")]
    CollectKeys(#[from] collect_viewing_keys::CollectKeysError),

    #[error("Error indexing events")]
    Index(#[from] index_events::IndexEventsError),

    #[error("Error revoking txs")]
    Revoke(#[from] revoke::RevokeError),

    #[error("Error revealing tx")]
    Reveal(#[from] reveal::RevealError),

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
            batch_size,
        } => {
            let connection = db::init(&db.path)?;
            index_events::run(rpc_url, shielder_address, *batch_size, connection).await?
        }
        cli::Command::Revoke { db } => {
            let connection = db::init(&db.path)?;
            revoke::run(connection).await?
        }
        cli::Command::Reveal { db, tx_hash } => {
            let connection = db::init(&db.path)?;
            reveal::run(connection, tx_hash).await?
        }
    }

    Ok(())
}
