use alloy_primitives::U256;
use anyhow::Result;
use shielder_rust_sdk::{
    account::{
        call_data::{DepositCallType, MerkleProof},
        ShielderAction,
    },
    contract::{
        call_type::Call, events::get_event, merkle_path::get_current_merkle_path,
        ShielderContract::DepositNative,
    },
};
use tracing::{debug, info};

use crate::{
    app_state::AppState,
    shielder_ops::pk::{get_proving_equipment, CircuitType},
};

pub async fn deposit(app_state: &mut AppState, amount: u128) -> Result<()> {
    let amount = U256::from(amount);
    let (params, pk) = get_proving_equipment(CircuitType::Deposit)?;
    let leaf_index = app_state
        .account
        .current_leaf_index()
        .expect("Deposit mustn't be the first action");
    let shielder_user = app_state.create_shielder_user();
    let (merkle_root, merkle_path) = get_current_merkle_path(leaf_index, &shielder_user).await?;
    let (tx_hash, block_hash) = shielder_user
        .deposit_native::<Call>(
            app_state.account.prepare_call::<DepositCallType>(
                &params,
                &pk,
                amount,
                &MerkleProof {
                    root: merkle_root,
                    path: merkle_path,
                },
            ),
            amount,
        )
        .await?;

    let deposit_event = get_event::<DepositNative>(
        &app_state.create_simple_provider().await?,
        tx_hash,
        block_hash,
    )
    .await?;
    debug!("Deposit event: {deposit_event:?}");

    app_state.account.register_action(ShielderAction::deposit(
        amount,
        deposit_event.newNoteIndex,
        tx_hash,
    ));
    info!("Deposited {amount} tokens");
    Ok(())
}
