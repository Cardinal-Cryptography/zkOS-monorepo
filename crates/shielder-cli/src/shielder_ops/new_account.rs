use alloy_primitives::U256;
use anyhow::Result;
use shielder_account::{
    call_data::{NewAccountCall, NewAccountCallExtra, NewAccountCallType, TokenKind},
    ShielderAction,
};
use shielder_circuits::GrumpkinPointAffine;
use shielder_contract::{
    call_type::{Call, DryRun},
    events::get_event,
    ShielderContract::NewAccount,
};
use tracing::{debug, info};

use crate::{
    app_state::AppState,
    shielder_ops::{
        get_mac_salt,
        pk::{get_proving_equipment, CircuitType},
    },
};

pub async fn new_account(app_state: &mut AppState, amount: u128, token: TokenKind) -> Result<()> {
    let amount = U256::from(amount);
    let user = app_state.create_shielder_user();
    let anonymity_revoker_public_key = user.anonymity_revoker_pubkey::<DryRun>().await?;
    let call = prepare_call(app_state, amount, token, anonymity_revoker_public_key)?;

    let (tx_hash, block_hash) = match token {
        TokenKind::Native => {
            user.new_account_native::<Call>(call.try_into().unwrap(), amount)
                .await?
        }
        TokenKind::ERC20(_) => {
            user.new_account_erc20::<Call>(call.try_into().unwrap())
                .await?
        }
    };

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
            tx_hash,
            token,
        ));
    info!("Created new account with {amount} tokens");
    Ok(())
}

fn get_encryption_salt() -> U256 {
    get_mac_salt()
}

fn prepare_call(
    app_state: &AppState,
    amount: U256,
    token: TokenKind,
    anonymity_revoker_public_key: GrumpkinPointAffine<U256>,
) -> Result<NewAccountCall> {
    let (params, pk) = get_proving_equipment(CircuitType::NewAccount)?;
    let extra = NewAccountCallExtra {
        anonymity_revoker_public_key,
        encryption_salt: get_encryption_salt(),
        mac_salt: get_mac_salt(),
    };

    Ok(app_state
        .account
        .prepare_call::<NewAccountCallType>(&params, &pk, token, amount, &extra))
}
