use std::{cmp::min, thread::sleep, time::Duration};

use alloy_transport::TransportErrorKind;
use clap::Parser;
use cli::{ChainConfig, Cli};
use log::{error, info};
use recoverable_error::MaybeRecoverableError;
use thiserror::Error;

mod cli;
mod collect_viewing_keys;
mod db;
mod generate;
mod index_events;
mod recoverable_error;
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

    #[error("Cannot recover from this variant of MaybeRecoverable")]
    MaybeRecoverable(#[from] MaybeRecoverableError),

    #[error("Error revoking txs")]
    Revoke(#[from] revoke::RevokeError),

    #[error("Error revealing tx")]
    Reveal(#[from] reveal::RevealError),

    #[error("Db Error")]
    Db(#[from] rusqlite::Error),
}

pub async fn retry_with_backoff<F, Fut, T>(mut op: F) -> Result<T, MaybeRecoverableError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, MaybeRecoverableError>>,
{
    let mut delay = DEFAULT_BACKOFF;

    loop {
        match op().await {
            Ok(result) => return Ok(result),

            Err(MaybeRecoverableError::Rpc(alloy_json_rpc::RpcError::Transport(
                TransportErrorKind::HttpError(http_err),
            ))) if http_err.is_rate_limit_err() => {
                delay = min(MAX_BACKOFF, delay * 2);
                info!("Rate limited. Waiting {:?} before retrying.", delay);
                sleep(delay);
            }

            Err(e) => return Err(e),
        }
    }
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
            retry_with_backoff(|| {
                collect_viewing_keys::run(
                    rpc_url,
                    shielder_address,
                    private_key_file,
                    endianess.clone(),
                    *from_block,
                    &db.path,
                    *redact_sensitive_data,
                )
            })
            .await?
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
        } => {
            retry_with_backoff(|| {
                index_events::run(
                    rpc_url,
                    shielder_address,
                    *from_block,
                    *batch_size,
                    &db.path,
                )
            })
            .await?
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
