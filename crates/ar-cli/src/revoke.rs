use rusqlite::Connection;
use shielder_circuits::{poseidon::off_circuit::hash, Fr};
use thiserror::Error;

use crate::db::{self, Event, ViewingKey};

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum RevokeError {
    #[error("Error while querying or persisting data")]
    Db(#[from] rusqlite::Error),

    #[error("Error while trying to convert into field element from an LE byte representation")]
    FieldConversion(String),
}

/// Given tx-hash find all the matching txs
///   - for every k: look if mac matches: mac_commitment = h(k, r), where r = mac_salt from the tx
pub async fn run(tx_hash: &[u8; 32], connection: Connection) -> Result<(), RevokeError> {
    let keys = db::query_viewing_keys(&connection)?;
    let events = db::query_events(&connection)?;
    println!("@1 {events:?}");

    for Event {
        mac_commitment,
        mac_salt,
        viewing_key,
        tx_hash,
        block_number,
    } in events
    {
        if viewing_key.is_none() {
            let commitment = blob_to_field(&mac_commitment)?;

            for ViewingKey { viewing_key: key } in &keys {
                let maybe_commitment = hash(&[blob_to_field(&mac_salt)?, blob_to_field(key)?]);

                if commitment.eq(&maybe_commitment) {
                    db::upsert_event(
                        &connection,
                        Event {
                            tx_hash,
                            block_number,
                            mac_salt,
                            mac_commitment,
                            viewing_key: Some(key.clone()),
                        },
                    )?;
                    break;
                }
            }
        }
    }

    let events = db::query_events(&connection)?;
    println!("@2 {events:?}");

    Ok(())
}

fn blob_to_field(blob: &[u8]) -> Result<Fr, RevokeError> {
    if blob.len() != 32 {
        return Err(RevokeError::FieldConversion(format!(
            "Expected 32 bytes, but got {} bytes",
            blob.len()
        )));
    }

    let bytes: [u8; 32] = blob.try_into().map_err(|_| {
        RevokeError::FieldConversion("Failed to convert &[u8] to [u8; 32]".to_string())
    })?;

    Fr::from_bytes(&bytes)
        .into_option()
        .ok_or(RevokeError::FieldConversion(
            "Failed to convert to `mac_salt`".to_string(),
        ))
}
