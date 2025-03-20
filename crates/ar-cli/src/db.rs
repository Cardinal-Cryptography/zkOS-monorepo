use std::path::PathBuf;

use rusqlite::{Connection, Result, Row};
use thiserror::Error;

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

/// Query event by it's tx_hash
pub fn query_event(connection: &Connection, tx_hash: &[u8; 32]) -> Result<Event, rusqlite::Error> {
    connection.query_row(
        "SELECT tx_hash, block_number, mac_salt, mac_commitment, viewing_key FROM events WHERE tx_hash = ?1",
        [tx_hash],
        |row|  {
            Ok(Event {
                tx_hash: row.get(0)?,
                block_number: row.get(1)?,
                mac_salt: row.get(2)?,
                mac_commitment: row.get(3)?,
                viewing_key: row.get(4)?,
            })
        })
}

/// Query events by optional viewing_key
pub fn query_events(
    connection: &Connection,
    viewing_key: Option<Vec<u8>>,
) -> Result<Vec<Event>, rusqlite::Error> {
    let statement = match viewing_key {
        Some(_) => "SELECT tx_hash, block_number, mac_salt, mac_commitment, viewing_key FROM events where viewing_key = ?1", 
        None => "SELECT tx_hash, block_number, mac_salt, mac_commitment, viewing_key FROM events", 
    };

    let mut query = connection.prepare(statement)?;

    let f = |row: &Row| -> Result<Event, rusqlite::Error> {
        Ok(Event {
            tx_hash: row.get(0)?,
            block_number: row.get(1)?,
            mac_salt: row.get(2)?,
            mac_commitment: row.get(3)?,
            viewing_key: row.get(4)?,
        })
    };

    let results = match viewing_key {
        Some(key) => query.query_map([key], f)?,
        None => query.query_map([], f)?,
    };

    let mut events = vec![];
    for r in results {
        events.push(r?);
    }

    Ok(events)
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

pub fn query_viewing_keys(connection: &Connection) -> Result<Vec<ViewingKey>, rusqlite::Error> {
    let mut query = connection.prepare("SELECT viewing_key FROM viewing_keys")?;
    let result = query.query_map([], |row| {
        Ok(ViewingKey {
            viewing_key: row.get(0)?,
        })
    })?;

    let mut keys = vec![];
    for r in result {
        keys.push(r?);
    }

    Ok(keys)
}
