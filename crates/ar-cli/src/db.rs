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

#[derive(Debug)]
pub struct Event {
    pub tx_hash: Vec<u8>,
    pub block_number: u64,
    pub mac_salt: Vec<u8>,
    pub mac_commitment: Vec<u8>,
    pub viewing_key: Option<Vec<u8>>,
}

pub fn create_events_table(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute(
        "CREATE TABLE IF NOT EXISTS events (
            tx_hash BLOB PRIMARY KEY,
            block_number INTEGER NOT NULL,
            mac_salt BLOB NOT NULL,
            mac_commitment BLOB NOT NULL,
            viewing_key BLOB
        )",
        (),
    )?;
    Ok(())
}

pub fn upsert_event(connection: &Connection, event: Event) -> Result<(), rusqlite::Error> {
    connection.execute(
        "REPLACE INTO events (tx_hash, block_number, mac_salt, mac_commitment, viewing_key) VALUES (?1, ?2, ?3, ?4, ?5)",
        (&event.tx_hash, &event.block_number, &event.mac_salt, event.mac_commitment, event.viewing_key),
    )?;

    Ok(())
}

#[derive(Debug)]
pub struct ViewingKey {
    pub viewing_key: Vec<u8>,
}

pub fn create_viewing_keys_table(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute(
        "CREATE TABLE IF NOT EXISTS viewing_keys (
            viewing_key BLOB PRIMARY KEY
        )",
        (),
    )?;
    Ok(())
}

pub fn upsert_viewing_key(
    connection: &Connection,
    viewing_key: ViewingKey,
) -> Result<(), rusqlite::Error> {
    connection.execute(
        "REPLACE INTO viewing_keys (viewing_key) VALUES (?1)",
        (viewing_key.viewing_key,),
    )?;

    Ok(())
}
