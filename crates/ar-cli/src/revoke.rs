use log::info;
use rusqlite::Connection;
use shielder_circuits::poseidon::off_circuit::hash;
use crate::common::blob_to_field;


use crate::{db::{self, Event, ViewingKey}, error::Error};

/// Revoke known txs
///
/// For every event look if mac_commitment matches h(k, r),
/// where:
/// - r = mac_salt from the tx
/// - k \in keys
pub async fn run(connection: Connection) -> Result<(), Error> {
    let keys = db::query_viewing_keys(&connection)?;
    let events = db::query_events(&connection, None)?;

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
                let expected_commitment = hash(&[blob_to_field(&mac_salt)?, blob_to_field(key)?]);
                if commitment.eq(&expected_commitment) {
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

    info!("Done");
    Ok(())
}


