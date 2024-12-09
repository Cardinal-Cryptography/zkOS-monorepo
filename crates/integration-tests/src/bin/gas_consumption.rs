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
    deploy::{deployment, Deployment},
    deposit_native_proving_params, invoke_shielder_call, new_account_native_proving_params,
    withdraw_native_proving_params,
};
use shielder_rust_sdk::{
    account::ShielderAccount,
    contract::ShielderContract::{depositNativeCall, newAccountNativeCall, withdrawNativeCall},
};

#[derive(Debug)]
enum Calldata {
    NewAccounNativeCall(newAccountNativeCall),
    DepositNativeCall(depositNativeCall),
    WithdrawNativeCall(withdrawNativeCall),
}

fn main() {
    let mut deployment = deployment(
        &new_account_native_proving_params(),
        &deposit_native_proving_params(),
        &withdraw_native_proving_params(),
    );

    let mut shielder_account = ShielderAccount::new(U256::from(1));
    let amount = U256::from(10);
    let calldata = new_account_native_calldata(&mut deployment, &mut shielder_account, amount);

    measure_gas(
        Calldata::NewAccounNativeCall(calldata),
        &mut deployment,
        &mut shielder_account,
    );

    let calldata = deposit_native_calldata(&mut deployment, &mut shielder_account, amount).0;

    measure_gas(
        Calldata::DepositNativeCall(calldata),
        &mut deployment,
        &mut shielder_account,
    );

    let calldata = withdraw_native_calldata(
        &mut deployment,
        &mut shielder_account,
        prepare_args(amount, U256::from(1)),
    )
    .0;

    measure_gas(
        Calldata::WithdrawNativeCall(calldata),
        &mut deployment,
        &mut shielder_account,
    );
}

fn measure_gas(
    calldata: Calldata,
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
) {
    let gas_used = match calldata {
        Calldata::NewAccounNativeCall(calldata) => {
            new_account_native_call(deployment, shielder_account, U256::from(10), &calldata)
                .unwrap()
                .1
                .gas_used
        }
        Calldata::DepositNativeCall(calldata) => {
            deposit_native_call(deployment, shielder_account, U256::from(10), &calldata)
                .unwrap()
                .1
                .gas_used
        }
        Calldata::WithdrawNativeCall(calldata) => {
            withdraw_native_call(deployment, shielder_account, &calldata)
                .unwrap()
                .1
                .gas_used
        }
    };

    println!("{}: {gas_used}", &calldata);
}
