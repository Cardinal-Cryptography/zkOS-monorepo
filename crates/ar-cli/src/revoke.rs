use rusqlite::Connection;
use thiserror::Error;

use crate::db;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum RevokeError {
    #[error("Error while querying or persisting data")]
    Db(#[from] rusqlite::Error),
}

/// Given tx-hash find all the matching txs
///   - for every k: look if mac matches: mac_commitmet = h(k, r), r = mac_salt from the tx
pub async fn run(tx_hash: &[u8; 32], connection: Connection) -> Result<(), RevokeError> {
    let keys = db::query_viewing_keys(&connection)?;

    println!("{keys:?}");

    Ok(())
}
