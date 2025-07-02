use alloy_primitives::{Address, Bytes, U256};
use anyhow::Result;
use shielder_account::{
    call_data::{DepositCall, DepositCallType, DepositExtra},
    ShielderAction, Token,
};
use shielder_contract::{
    call_type::Call, events::get_event, merkle_path::get_current_merkle_path,
    ShielderContract::Deposit,
};
use shielder_setup::consts::{ARITY, TREE_HEIGHT};
use tracing::{debug, info};

use crate::{
    app_state::AppState,
    shielder_ops::{
        get_mac_salt,
        pk::{get_proving_equipment, CircuitType},
    },
};

pub async fn deposit(
    app_state: &mut AppState,
    amount: u128,
    token: Token,
    memo: Vec<u8>,
) -> Result<()> {
    let amount = U256::from(amount);
    let memo = Bytes::from(memo);
    let leaf_index = app_state.accounts[&token.address()]
        .current_leaf_index()
        .expect("Deposit mustn't be the first action");
    let shielder_user = app_state.create_shielder_user();
    let (_merkle_root, merkle_path) = get_current_merkle_path(leaf_index, &shielder_user).await?;

    let call = prepare_call(
        app_state,
        amount,
        token,
        merkle_path,
        shielder_user.address(),
        memo,
    )?;
    let (tx_hash, block_hash) = match token {
        Token::Native => {
            shielder_user
                .deposit_native::<Call>(call.try_into().unwrap(), amount)
                .await?
        }
        Token::ERC20(_) => {
            shielder_user
                .deposit_erc20::<Call>(call.try_into().unwrap())
                .await?
        }
    };

    let deposit_event = get_event::<Deposit>(
        &app_state.create_simple_provider().await?,
        tx_hash,
        block_hash,
    )
    .await?;
    debug!("Deposit event: {deposit_event:?}");

    app_state
        .accounts
        .get_mut(&token.address())
        .unwrap()
        .register_action(ShielderAction::deposit(
            amount,
            deposit_event.newNoteIndex,
            tx_hash,
            token,
        ));
    info!("Deposited {amount} tokens");
    Ok(())
}

fn prepare_call(
    app_state: &AppState,
    amount: U256,
    token: Token,
    merkle_path: [[U256; ARITY]; TREE_HEIGHT],
    caller_address: Address,
    memo: Bytes,
) -> Result<DepositCall> {
    let (params, pk) = get_proving_equipment(CircuitType::Deposit)?;
    let extra = DepositExtra {
        merkle_path,
        mac_salt: get_mac_salt(),
        caller_address,
        memo,
    };

    Ok(app_state.accounts[&token.address()]
        .prepare_call::<DepositCallType>(&params, &pk, token, amount, &extra))
}
