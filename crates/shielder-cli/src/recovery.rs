use alloy_primitives::U256;
use anyhow::Result;
use shielder_account::Token;
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_contract::{providers::create_simple_provider, recovery::get_shielder_action};
use type_conversions::{field_to_u256, u256_to_field};

use crate::app_state::AppState;

pub async fn recover_state(
    app_state: &mut AppState,
    token: Token,
    zkid_seed: Option<U256>,
) -> Result<()> {
    let shielder_user = app_state.create_shielder_user();
    app_state.ensure_account_exist(token, zkid_seed);
    let AppState {
        accounts,
        node_rpc_url,
        ..
    } = app_state;
    let provider = create_simple_provider(node_rpc_url).await?;

    let account = accounts
        .get_mut(&token.address())
        .expect("We have just ensured the account exists");

    loop {
        let expected_nullifier = account.previous_nullifier();
        let expected_nullifier_hash = field_to_u256(hash(&[u256_to_field(expected_nullifier)]));

        match get_shielder_action(&provider, &shielder_user, expected_nullifier_hash).await? {
            Some(action) => account.register_action(action),
            None => break,
        }
    }
    Ok(())
}
