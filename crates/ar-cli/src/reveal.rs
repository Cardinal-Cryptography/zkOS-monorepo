use log::{info, warn};
use rusqlite::Connection;

use crate::{
    db::{self, Event},
    error::Error,
};

/// If the tx has a known viewing key return other txs made from the account with the same id
///
/// Events are printed to stdout in a human readable output
pub async fn run(connection: Connection, tx_hash: &[u8; 32]) -> Result<(), Error> {
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
