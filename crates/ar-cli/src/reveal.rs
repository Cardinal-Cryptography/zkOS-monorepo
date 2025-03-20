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

pub async fn run(connection: Connection, tx_hash: &[u8; 32]) -> Result<(), RevealError> {
    let Event { viewing_key, .. } = db::query_event(&connection, tx_hash)?;

    if let Some(key) = viewing_key {
        info!("This tx matches the viewing key {key:?}");
        let events = db::query_events(&connection, Some(key))?;

        // TODO : human readable output
        info!("Other txs matching the key {events:?}");
    } else {
        warn!("No viewing key matching this tx could be found. Run `index-events` and `collect-keys` commands to populate the db.");
    }

    info!("Done");
    Ok(())
}
