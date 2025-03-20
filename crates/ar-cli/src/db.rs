use std::path::PathBuf;

use rusqlite::{Connection, Result};
use thiserror::Error;

// #[derive(Debug, Error)]
// #[error(transparent)]
// #[non_exhaustive]
// pub enum DbError {}

pub fn init(path: PathBuf) -> Result<Connection, rusqlite::Error> {
    Connection::open(path)
}
