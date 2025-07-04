use alloy_primitives::{Address, Bytes, U256};
use alloy_provider::Provider;
use alloy_signer_local::PrivateKeySigner;
use anyhow::Result;
use shielder_account::{
    call_data::{DepositCall, DepositCallType, DepositExtra},
    ShielderAccount, Token,
};
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_contract::{
    call_type::{Call, EstimateGas},
    merkle_path::get_current_merkle_path,
    providers::create_simple_provider,
    recovery::get_shielder_action,
    ConnectionPolicy, NoProvider, ShielderUser,
};
use shielder_setup::{
    consts::{ARITY, TREE_HEIGHT},
    protocol_fee::compute_protocol_fee_from_gross,
};
use tracing::info;
use type_conversions::{field_to_u256, u256_to_field};

use crate::shielder::{
    get_mac_salt, new_account::create_new_account, pk::DEPOSIT_PROVING_EQUIPMENT,
};

pub async fn estimate_deposit_gas(
    private_key: U256,
    shielder_seed: U256,
    rpc_url: String,
    contract_address: Address,
    token: Token,
    amount: U256,
    protocol_fee_bps: U256,
) -> Result<u64> {
    let amount = U256::from(amount);
    let signer = PrivateKeySigner::from_bytes(&private_key.into())
        .expect("Invalid key format - cannot cast to PrivateKeySigner");
    let mut shielder_account = ShielderAccount::new(shielder_seed, token);

    let user = ShielderUser::<NoProvider>::new(
        contract_address,
        ConnectionPolicy::OnDemand {
            rpc_url: rpc_url.clone(),
            signer,
        },
    );

    let protocol_fee = compute_protocol_fee_from_gross(U256::from(amount), protocol_fee_bps);

    ensure_account_created(
        contract_address,
        &mut shielder_account,
        &user,
        token,
        amount,
        &rpc_url,
        protocol_fee,
    )
    .await?;

    let leaf_index = shielder_account
        .current_leaf_index()
        .expect("Deposit mustn't be the first action");
    let (_merkle_root, merkle_path) = get_current_merkle_path(leaf_index, &user).await?;

    let call = prepare_call(
        shielder_account,
        amount,
        token,
        merkle_path,
        user.address(),
        protocol_fee,
        Bytes::from(vec![]),
    )?;
    let estimated_gas = match token {
        Token::Native => {
            user.deposit_native::<EstimateGas>(call.try_into().unwrap(), amount)
                .await?
        }
        Token::ERC20(_) => {
            user.deposit_erc20::<EstimateGas>(call.try_into().unwrap())
                .await?
        }
    };
    Ok(estimated_gas)
}

fn prepare_call(
    shielder_account: ShielderAccount,
    amount: U256,
    token: Token,
    merkle_path: [[U256; ARITY]; TREE_HEIGHT],
    caller_address: Address,
    protocol_fee: U256,
    memo: Bytes,
) -> Result<DepositCall> {
    let (params, pk) = DEPOSIT_PROVING_EQUIPMENT.clone();
    let extra = DepositExtra {
        merkle_path,
        mac_salt: get_mac_salt(),
        caller_address,
        protocol_fee,
        memo,
    };

    Ok(shielder_account.prepare_call::<DepositCallType>(&params, &pk, token, amount, &extra))
}

async fn ensure_account_created(
    contract_address: Address,
    account: &mut ShielderAccount,
    shielder_user: &ShielderUser,
    token: Token,
    amount: U256,
    rpc_url: &str,
    protocol_fee: U256,
) -> Result<()> {
    recover_state(account, shielder_user, rpc_url).await?;
    let provider = create_simple_provider(rpc_url).await?;

    if account.nonce == 0 {
        info!("Account is not created yet. Creating a new account...");
        if let Token::ERC20(token_address) = token {
            // approve amount * 2 to ensure that we would have allowance after the new account creation
            let (tx_hash, _) = shielder_user
                .approve_erc20::<Call>(token_address, contract_address, amount * U256::from(2))
                .await?;
            provider
                .get_transaction_receipt(tx_hash)
                .await?
                .expect("Transaction receipt not found");
        }
        let tx_hash =
            create_new_account(account, shielder_user, amount, token, protocol_fee).await?;

        provider
            .get_transaction_receipt(tx_hash)
            .await?
            .expect("Transaction receipt not found");
    }

    recover_state(account, shielder_user, rpc_url).await?;

    Ok(())
}

async fn recover_state(
    account: &mut ShielderAccount,
    shielder_user: &ShielderUser,
    rpc_url: &str,
) -> Result<()> {
    let provider = create_simple_provider(rpc_url).await?;

    loop {
        let expected_nullifier = account.previous_nullifier();
        let expected_nullifier_hash = field_to_u256(hash(&[u256_to_field(expected_nullifier)]));

        match get_shielder_action(&provider, shielder_user, expected_nullifier_hash).await? {
            Some(action) => account.register_action(action),
            None => break,
        }
    }
    Ok(())
}
