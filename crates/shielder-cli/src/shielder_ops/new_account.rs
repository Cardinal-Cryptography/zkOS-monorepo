use alloy_primitives::U256;
use anyhow::Result;
use shielder_rust_sdk::{
    account::{call_data::NewAccountCallType, ShielderAction},
    contract::{call_type::Call, events::get_event, ShielderContract::NewAccountNative},
};
use tracing::{debug, info};

use crate::{
    app_state::AppState,
    shielder_ops::pk::{get_proving_equipment, CircuitType},
};

pub async fn new_account(app_state: &mut AppState, amount: u128) -> Result<()> {
    let amount = U256::from(amount);
    let (params, pk) = get_proving_equipment(CircuitType::NewAccount)?;
    let (tx_hash, block_hash) = app_state
        .create_shielder_user()
        .create_new_account_native::<Call>(
            app_state
                .account
                .prepare_call::<NewAccountCallType>(&params, &pk, amount, &()),
            amount,
        )
        .await?;

    let new_account_event = get_event::<NewAccountNative>(
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
            tx_hash,
        ));
    info!("Created new account with {amount} tokens");
    Ok(())
}
