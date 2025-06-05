use std::str::FromStr;

use alloy_primitives::{Address, U256};
use alloy_signer_local::PrivateKeySigner;
use anyhow::Result;
use shielder_account::{
    call_data::{DepositCall, DepositCallType, DepositExtra},
    ShielderAccount, Token,
};
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_contract::{
    call_type::EstimateGas, merkle_path::get_current_merkle_path,
    providers::create_simple_provider, recovery::get_shielder_action, ConnectionPolicy, NoProvider,
    ShielderUser,
};
use shielder_setup::consts::{ARITY, TREE_HEIGHT};
use type_conversions::{field_to_u256, u256_to_field};

use crate::shielder::{
    get_mac_salt,
    pk::{get_proving_equipment, CircuitType},
};

pub async fn estimate_deposit_gas(
    private_key: String,
    rpc_url: String,
    contract_address: Address,
    token: Token,
    amount: U256,
) -> Result<u64> {
    let signer = PrivateKeySigner::from_str(&private_key)
        .expect("Invalid key format - cannot cast to PrivateKeySigner");
    let mut shielder_account = ShielderAccount::new(U256::from_str(&private_key)?, token);

    let user = ShielderUser::<NoProvider>::new(
        contract_address,
        ConnectionPolicy::OnDemand {
            rpc_url: rpc_url.clone(),
            signer,
        },
    );

    recover_state(&mut shielder_account, user.clone(), &rpc_url).await?;

    let leaf_index = shielder_account
        .current_leaf_index()
        .expect("Deposit mustn't be the first action");
    let (_merkle_root, merkle_path) = get_current_merkle_path(leaf_index, &user).await?;

    let call = prepare_call(shielder_account, amount, token, merkle_path, user.address())?;
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
) -> Result<DepositCall> {
    let (params, pk) = get_proving_equipment(CircuitType::Deposit)?;
    let extra = DepositExtra {
        merkle_path,
        mac_salt: get_mac_salt(),
        caller_address,
    };

    Ok(shielder_account.prepare_call::<DepositCallType>(&params, &pk, token, amount, &extra))
}

async fn recover_state(
    account: &mut ShielderAccount,
    shielder_user: ShielderUser,
    rpc_url: &str,
) -> Result<()> {
    let provider = create_simple_provider(rpc_url).await?;

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
