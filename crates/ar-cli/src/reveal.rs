use log::{info, warn};
use rusqlite::Connection;
use thiserror::Error;

use crate::db::{self, Event};

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum RevealError {
    #[error("Error while querying or persisting data")]
    Db(#[from] rusqlite::Error),
}

/// If the tx has a known viewing key return other txs made from the account with the same id
///
/// Human readable output
pub async fn run(connection: Connection, tx_hash: &[u8; 32]) -> Result<(), RevealError> {
    let Event { viewing_key, .. } = db::query_event(&connection, tx_hash)?;

    if let Some(key) = viewing_key {
        info!("This tx matches the key 0x{}", hex::encode(&key));
        let events = db::query_events(&connection, Some(key))?;

        for event in events {
            info!("{event}");
        }
    } else {
        warn!("No viewing key matching this tx could be found. Run `index-events` and `collect-keys` commands to populate the db.");
    }

    info!("Done");
    Ok(())
}
