use std::{cmp::min, thread::sleep, time::Duration};

use alloy_transport::TransportErrorKind;
use clap::Parser;
use cli::{ChainConfig, Cli};
use collect_viewing_keys::CollectKeysError;
use index_events::IndexEventsError;
use log::{error, info};
use thiserror::Error;

mod cli;
mod collect_viewing_keys;
mod db;
mod generate;
mod index_events;
mod reveal;
mod revoke;

const DEFAULT_BACKOFF: Duration = Duration::from_millis(2000); // 2 seconds
const MAX_BACKOFF: Duration = Duration::from_millis(600000); // 10 minutes

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
            endianess,
            redact_sensitive_data,
            common:
                ChainConfig {
                    rpc_url,
                    shielder_address,
                    from_block,
                },
            db,
        } => {
            let mut delay = DEFAULT_BACKOFF;

            loop {
                match collect_viewing_keys::run(
                    rpc_url,
                    shielder_address,
                    private_key_file,
                    endianess.clone(),
                    *from_block,
                    &db.path,
                    *redact_sensitive_data,
                )
                .await
                {
                    Ok(_) => {
                        info!("Done");
                        break;
                    }

                    Err(CollectKeysError::Rpc(alloy_json_rpc::RpcError::Transport(
                        TransportErrorKind::HttpError(http_err),
                    ))) => {
                        if http_err.is_rate_limit_err() {
                            delay = min(MAX_BACKOFF, 2 * delay);
                            info!("Waiting {delay:?} before retrying.");
                            sleep(delay);
                        } else {
                            error!("{http_err:?}");
                            break;
                        }
                    }

                    Err(why) => {
                        error!("{why:?}");
                        break;
                    }
                }
            }
        }
        cli::Command::IndexEvents {
            common:
                ChainConfig {
                    rpc_url,
                    shielder_address,
                    from_block,
                },
            db,
            batch_size,
        } => loop {
            let mut delay = DEFAULT_BACKOFF;

            match index_events::run(
                rpc_url,
                shielder_address,
                *from_block,
                *batch_size,
                &db.path,
            )
            .await
            {
                Ok(_) => {
                    info!("Done");
                    break;
                }

                Err(IndexEventsError::Rpc(alloy_json_rpc::RpcError::Transport(
                    TransportErrorKind::HttpError(http_err),
                ))) => {
                    if http_err.is_rate_limit_err() {
                        delay = min(MAX_BACKOFF, 2 * delay);
                        info!("Waiting {delay:?} before retrying.");
                        sleep(delay);
                    } else {
                        error!("{http_err:?}");
                        break;
                    }
                }

                Err(why) => {
                    error!("{why:?}");
                    break;
                }
            }
        },
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
