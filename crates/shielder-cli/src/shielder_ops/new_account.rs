use alloy_primitives::{Address, Bytes, U256};
use anyhow::Result;
use shielder_account::{
    call_data::{NewAccountCall, NewAccountCallExtra, NewAccountCallType},
    ShielderAction, Token,
};
use shielder_circuits::GrumpkinPointAffine;
use shielder_contract::{
    call_type::{Call, DryRun},
    events::get_event,
    ShielderContract::NewAccount,
};
use shielder_setup::protocol_fee::compute_protocol_fee_from_net;
use tracing::{debug, info};

use crate::{
    app_state::AppState,
    shielder_ops::{
        get_mac_salt,
        pk::{get_proving_equipment, CircuitType},
    },
};

pub async fn new_account(
    app_state: &mut AppState,
    amount: u128,
    token: Token,
    memo: Vec<u8>,
) -> Result<()> {
    let memo = Bytes::from(memo);
    let user = app_state.create_shielder_user();
    let anonymity_revoker_public_key = user.anonymity_revoker_pubkey::<DryRun>().await?;

    let protocol_fee_bps = if let Some(protocol_fee_bps) = app_state.protocol_fees.deposit_fee {
        protocol_fee_bps
    } else {
        let protocol_fee_bps = user.protocol_deposit_fee_bps::<DryRun>().await?;
        app_state.protocol_fees.deposit_fee = Some(protocol_fee_bps);
        protocol_fee_bps
    };

    let protocol_fee = compute_protocol_fee_from_net(U256::from(amount), protocol_fee_bps);
    let amount = U256::from(amount) + protocol_fee;

    let call = prepare_call(
        app_state,
        amount,
        token,
        anonymity_revoker_public_key,
        user.address(),
        protocol_fee,
        memo,
    )?;

    let (tx_hash, block_hash) = match token {
        Token::Native => {
            user.new_account_native::<Call>(call.try_into().unwrap(), amount)
                .await?
        }
        Token::ERC20(address) => {
            user.approve_erc20::<Call>(address, app_state.contract_address, U256::MAX)
                .await?;
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
        .accounts
        .get_mut(&token.address())
        .unwrap()
        .register_action(ShielderAction::new_account(
            amount,
            new_account_event.newNoteIndex,
            tx_hash,
            token,
            protocol_fee,
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
    token: Token,
    anonymity_revoker_public_key: GrumpkinPointAffine<U256>,
    caller_address: Address,
    protocol_fee: U256,
    memo: Bytes,
) -> Result<NewAccountCall> {
    let (params, pk) = get_proving_equipment(CircuitType::NewAccount)?;
    let extra = NewAccountCallExtra {
        anonymity_revoker_public_key,
        encryption_salt: get_encryption_salt(),
        mac_salt: get_mac_salt(),
        caller_address,
        protocol_fee,
        memo,
    };

    Ok(app_state.accounts[&token.address()]
        .prepare_call::<NewAccountCallType>(&params, &pk, token, amount, &extra))
}
