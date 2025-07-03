use alloy_primitives::{Address, Bytes, TxHash, U256};
use alloy_signer_local::PrivateKeySigner;
use anyhow::Result;
use shielder_account::{
    call_data::{NewAccountCall, NewAccountCallExtra, NewAccountCallType},
    ShielderAccount, Token,
};
use shielder_contract::{
    call_type::{Call, DryRun, EstimateGas},
    ConnectionPolicy, NoProvider, ShielderUser,
};
use shielder_setup::{
    protocol_fee::compute_protocol_fee_from_net, shielder_circuits::GrumpkinPointAffine,
};

use crate::shielder::{get_mac_salt, pk::NEW_ACCOUNT_PROVING_EQUIPMENT};

pub async fn estimate_new_account_gas(
    private_key: U256,
    shielder_seed: U256,
    rpc_url: String,
    contract_address: Address,
    token: Token,
    amount: U256,
    protocol_fee_bps: U256,
) -> Result<u64> {
    let signer = PrivateKeySigner::from_bytes(&private_key.into())
        .expect("Invalid key format - cannot cast to PrivateKeySigner");
    let shielder_account = ShielderAccount::new(shielder_seed, token);

    let user = ShielderUser::<NoProvider>::new(
        contract_address,
        ConnectionPolicy::OnDemand { rpc_url, signer },
    );

    let anonymity_revoker_public_key = user.anonymity_revoker_pubkey::<DryRun>().await?;

    let protocol_fee = compute_protocol_fee_from_net(U256::from(amount), protocol_fee_bps);
    let amount = U256::from(amount) + protocol_fee;

    let call = prepare_call(
        &shielder_account,
        amount,
        token,
        anonymity_revoker_public_key,
        user.address(),
        protocol_fee,
        Bytes::from(vec![]),
    )?;
    let estimated_gas = match token {
        Token::Native => {
            user.new_account_native::<EstimateGas>(call.try_into().unwrap(), amount)
                .await?
        }
        Token::ERC20(_) => {
            user.new_account_erc20::<EstimateGas>(call.try_into().unwrap())
                .await?
        }
    };

    Ok(estimated_gas)
}

fn prepare_call(
    shielder_account: &ShielderAccount,
    amount: U256,
    token: Token,
    anonymity_revoker_public_key: GrumpkinPointAffine<U256>,
    caller_address: Address,
    protocol_fee: U256,
    memo: Bytes,
) -> Result<NewAccountCall> {
    let (params, pk) = NEW_ACCOUNT_PROVING_EQUIPMENT.clone();
    // let (params, pk) = get_proving_equipment(CircuitType::NewAccount)?;
    let extra = NewAccountCallExtra {
        anonymity_revoker_public_key,
        encryption_salt: get_mac_salt(),
        mac_salt: get_mac_salt(),
        caller_address,
        protocol_fee,
        memo,
    };

    Ok(shielder_account.prepare_call::<NewAccountCallType>(&params, &pk, token, amount, &extra))
}

pub async fn create_new_account(
    shielder_account: &ShielderAccount,
    user: &ShielderUser,
    amount: U256,
    token: Token,
    protocol_fee: U256,
) -> Result<TxHash> {
    let anonymity_revoker_public_key = user.anonymity_revoker_pubkey::<DryRun>().await?;

    let call = prepare_call(
        shielder_account,
        amount,
        token,
        anonymity_revoker_public_key,
        user.address(),
        protocol_fee,
        Bytes::from(vec![]),
    )?;

    let (tx_hash, _) = match token {
        Token::Native => {
            user.new_account_native::<Call>(call.try_into().unwrap(), amount)
                .await?
        }
        Token::ERC20(_) => {
            user.new_account_erc20::<Call>(call.try_into().unwrap())
                .await?
        }
    };

    Ok(tx_hash)
}
