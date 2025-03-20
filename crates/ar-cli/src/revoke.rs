// 2) given tx-hash find all the matching txs
//    - for every k: look if mac matches: mac_commitmet = h(k, r), r = mac_salt from the tx
// go back in history and reveal all txs with the matching commitment

use thiserror::Error;

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum RevokeError {}

pub async fn run(tx_hash: &[u8; 32]) -> Result<(), RevokeError> {
    Ok(())
}
