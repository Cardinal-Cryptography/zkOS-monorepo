use alloy_primitives::{
    private::rand::{rngs::OsRng, Rng},
    U256,
};
use anyhow::Result;
use shielder_account::{
    call_data::{NewAccountCallExtra, NewAccountCallType, Token},
    ShielderAction,
};
use shielder_circuits::consts::FIELD_BITS;
use shielder_contract::{
    call_type::{Call, DryRun},
    events::get_event,
    ShielderContract::NewAccount,
};
use tracing::{debug, info};

use crate::{
    app_state::AppState,
    shielder_ops::pk::{get_proving_equipment, CircuitType},
};

pub async fn new_account(app_state: &mut AppState, amount: u128) -> Result<()> {
    let amount = U256::from(amount);
    let (params, pk) = get_proving_equipment(CircuitType::NewAccount)?;
    let user = app_state.create_shielder_user();
    let anonymity_revoker_public_key = user.anonymity_revoker_pubkey::<DryRun>().await?;
    let (tx_hash, block_hash) = user
        .create_new_account_native::<Call>(
            app_state
                .account
                .prepare_call::<NewAccountCallType>(
                    &params,
                    &pk,
                    Token::Native,
                    amount,
                    &NewAccountCallExtra {
                        anonymity_revoker_public_key,
                        encryption_salt: get_encryption_salt(),
                    },
                )
                .try_into()
                .unwrap(),
            amount,
        )
        .await?;

    let new_account_event = get_event::<NewAccount>(
        &app_state.create_simple_provider().await?,
        tx_hash,
        block_hash,
    )
    .await?;
    debug!("New account event: {new_account_event:?}");

    app_state
        .account
        .register_action(ShielderAction::new_account(
            amount,
            new_account_event.newNoteIndex,
            new_account_event.idHash,
            tx_hash,
        ));
    info!("Created new account with {amount} tokens");
    Ok(())
}

fn get_encryption_salt() -> [bool; FIELD_BITS] {
    let mut rng = OsRng;
    core::array::from_fn(|_| rng.gen_bool(0.5))
}
