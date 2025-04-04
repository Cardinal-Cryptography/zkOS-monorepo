use core::fmt;
use std::path::PathBuf;

use rusqlite::{Connection, Result, Row};

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

impl fmt::Display for Event {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let tx_hash_hex = hex::encode(&self.tx_hash);
        let mac_salt_hex = hex::encode(&self.mac_salt);
        let mac_commitment_hex = hex::encode(&self.mac_commitment);
        let viewing_key_hex = self
            .viewing_key
            .as_ref()
            .map_or("None".to_string(), hex::encode);
        write!(
            f,
            "Event {{\n  tx_hash: 0x{},\n  block_number: {},\n  mac_salt: 0x{},\n  mac_commitment: 0x{},\n  viewing_key: 0x{}\n}}",
            tx_hash_hex, self.block_number, mac_salt_hex, mac_commitment_hex, viewing_key_hex
        )
    }
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

    results.into_iter().collect()
}

pub fn create_checkpoint_table(
    connection: &Connection,
    table: &str,
) -> Result<(), rusqlite::Error> {
    connection.execute(
        &format!(
            "CREATE TABLE IF NOT EXISTS {table} (
            id INTEGER PRIMARY KEY,
            last_block_number INTEGER NOT NULL
        )"
        ),
        (),
    )?;
    Ok(())
}

pub fn update_checkpoint(
    connection: &Connection,
    table: &str,
    last_block_number: u64,
) -> Result<(), rusqlite::Error> {
    connection.execute(
        &format!("REPLACE INTO {table} (id, last_block_number) VALUES (0, ?1)"),
        (&last_block_number,),
    )?;

    Ok(())
}

pub fn query_checkpoint(connection: &Connection, table: &str) -> Result<u64, rusqlite::Error> {
    match connection.query_row(
        &format!("SELECT last_block_number FROM {table} WHERE id = 0"),
        [],
        |row| row.get::<_, u64>(0),
    ) {
        Ok(n) => Ok(n),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(0),
        Err(other) => Err(other),
    }
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
