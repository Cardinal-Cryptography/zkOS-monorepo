use alloy_primitives::U256;
use evm_utils::SuccessResult;
use integration_tests::{
    calls::new_account_native::prepare_call as new_account_native_calldata, deploy::deployment,
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

    let mut shielder_account = ShielderAccount::default();
    let amount = U256::from(10);
    let calldata = new_account_native_calldata(&mut deployment, &mut shielder_account, amount);

    let (_, SuccessResult { gas_used, .. }) =
        invoke_shielder_call(&mut deployment, &calldata, Some(amount)).unwrap();
}
