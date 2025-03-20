use std::path::PathBuf;

use rusqlite::{Connection, Result};
use thiserror::Error;

// #[derive(Debug, Error)]
// #[error(transparent)]
// #[non_exhaustive]
// pub enum DbError {}

pub fn init(path: &PathBuf) -> Result<Connection, rusqlite::Error> {
    Connection::open(path)
}

pub fn create_new_account_table(connection: Connection) -> Result<(), rusqlite::Error> {
    connection.execute(
        "CREATE TABLE IF NOT EXISTS new_account (
            tx_hash TEXT PRIMARY KEY,
            name TEXT NOT NULL
        )",
        (), // empty list of parameters.
    )?;

    Ok(())
}
