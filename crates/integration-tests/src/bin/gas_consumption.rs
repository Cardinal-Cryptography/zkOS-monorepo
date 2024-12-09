use alloy_primitives::U256;
use evm_utils::SuccessResult;
use integration_tests::{
    calls::{
        deposit_native::{
            invoke_call as deposit_native_call, prepare_call as deposit_native_calldata,
        },
        new_account_native::{
            invoke_call as new_account_native_call, prepare_call as new_account_native_calldata,
        },
        withdraw_native::{
            invoke_call as withdraw_native_call, prepare_args,
            prepare_call as withdraw_native_calldata,
        },
    },
    deploy::deployment,
    deposit_native_proving_params, invoke_shielder_call, new_account_native_proving_params,
    withdraw_native_proving_params,
};
use shielder_rust_sdk::account::ShielderAccount;

fn main() {
    let mut deployment = deployment(
        &new_account_native_proving_params(),
        &deposit_native_proving_params(),
        &withdraw_native_proving_params(),
    );

    let mut shielder_account = ShielderAccount::new(U256::from(1));
    let amount = U256::from(10);
    let calldata = new_account_native_calldata(&mut deployment, &mut shielder_account, amount);

    let SuccessResult { gas_used, .. } =
        new_account_native_call(&mut deployment, &mut shielder_account, amount, &calldata)
            .unwrap()
            .1;

    println!("@1: {gas_used}",);

    let calldata = deposit_native_calldata(&mut deployment, &mut shielder_account, amount).0;

    let SuccessResult { gas_used, .. } =
        deposit_native_call(&mut deployment, &mut shielder_account, amount, &calldata)
            .unwrap()
            .1;

    println!("@2: {gas_used}");

    let calldata = withdraw_native_calldata(
        &mut deployment,
        &mut shielder_account,
        prepare_args(amount, U256::from(1)),
    )
    .0;

    let SuccessResult { gas_used, .. } =
        withdraw_native_call(&mut deployment, &mut shielder_account, &calldata)
            .unwrap()
            .1;

    println!("@3: {gas_used}");
}
