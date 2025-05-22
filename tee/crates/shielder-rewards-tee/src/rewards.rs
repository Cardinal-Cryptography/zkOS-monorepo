use alloy_primitives::U256;
use base64::prelude::*;
use shielder_circuits::{poseidon::off_circuit::hash, Fr};
use shielder_rewards_common::protocol::Response;

use crate::{
    crypto::{blob_to_field, u256_to_field},
    AppState,
};

pub fn viewing_key_filter(viewing_key: Fr, mac_salt: U256, mac_commitment: U256) -> bool {
    let expected_commitment = hash(&[u256_to_field(mac_salt), viewing_key]);
    u256_to_field::<Fr>(mac_commitment).eq(&expected_commitment)
}

pub async fn calculate_reward(
    viewing_key_base64: String,
    app_state: &AppState,
) -> Result<Response, Box<dyn std::error::Error>> {
    let viewing_key_bytes = BASE64_STANDARD.decode(&viewing_key_base64)?;

    let viewing_key = blob_to_field(&viewing_key_bytes)?;

    let filtered_txs = app_state
        .txs
        .iter()
        .filter(|tx| viewing_key_filter(viewing_key, tx.mac_salt, tx.mac_commitment))
        .collect::<Vec<_>>();

    // Here you would calculate the reward based on the filtered transactions.
    let sum = filtered_txs
        .iter()
        .map(|tx| tx.value)
        .fold(U256::ZERO, |acc, value| acc + value);

    // For now, we just return a sum.

    Ok(Response::CalculateReward {
        reward: sum.to_string(),
    })
}
