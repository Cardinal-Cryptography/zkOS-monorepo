use std::{cmp::min, thread::sleep, time::Duration};

use alloy_transport::TransportErrorKind;
use clap::Parser;
use cli::{ChainConfig, Cli};
use error::Error;
use log::info;

mod cli;
mod collect_viewing_keys;
mod common;
mod db;
mod error;
mod generate;
mod index_events;
mod inspect;
mod reveal;
mod revoke;

const DEFAULT_BACKOFF: Duration = Duration::from_millis(2000); // 2 seconds
const MAX_BACKOFF: Duration = Duration::from_millis(600000); // 10 minutes

pub async fn retry_with_backoff<F, Fut, T>(mut op: F) -> Result<T, Error>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, Error>>,
{
    let mut delay = DEFAULT_BACKOFF;

    loop {
        match op().await {
            Ok(result) => return Ok(result),

            Err(Error::Rpc(alloy_json_rpc::RpcError::Transport(
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
async fn main() -> Result<(), Error> {
    let config = Cli::parse();
    env_logger::init();

    info!("{:#?}", &config);

    match &config.command {
        cli::Command::Generate { dir, seed } => generate::run(seed, dir)?,
        cli::Command::InspectPubkey { pk } => inspect::run_pubkey(pk)?,
        cli::Command::InspectMnemonic { mnemonic } => {
            inspect::run_mnemonic(mnemonic)?;
        }
        cli::Command::GenerateMnemonic => generate::run_mnemonic()?,
        cli::Command::CollectKeys {
            private_key_file,
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
