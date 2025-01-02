use std::str::FromStr;

use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolEventInterface, SolInterface};
use deploy::{
    Deployment, ACTOR_ADDRESS, ACTOR_INITIAL_BALANCE, DEPLOYER_ADDRESS, RECIPIENT_ADDRESS,
    RECIPIENT_INITIAL_BALANCE, RELAYER_ADDRESS, RELAYER_INITIAL_BALANCE,
};
use evm_utils::{EvmRunner, EvmRunnerError, SuccessResult};
use shielder_rust_sdk::contract::ShielderContract::{
    unpauseCall, ShielderContractErrors, ShielderContractEvents,
};

pub mod address_conversion;
pub mod calls;
pub mod deploy;
pub mod erc1967proxy;
pub mod limits;
pub mod merkle;

fn unpause_shielder(shielder: Address, evm: &mut EvmRunner) {
    evm.call(
        shielder,
        unpauseCall {}.abi_encode(),
        Some(Address::from_str(DEPLOYER_ADDRESS).unwrap()),
        None,
    )
    .expect("Call failed");
}

type CallResult = Result<(Vec<ShielderContractEvents>, SuccessResult), ShielderContractErrors>;

pub fn invoke_shielder_call(
    deployment: &mut Deployment,
    calldata: &impl SolCall,
    value: Option<U256>,
) -> CallResult {
    let success_result = deployment
        .evm
        .call(
            deployment.contract_suite.shielder,
            calldata.abi_encode(),
            Some(Address::from_str(ACTOR_ADDRESS).unwrap()),
            value,
        )
        .map_err(|e| {
            println!("ERROR {:?}", e);
            match e {
                EvmRunnerError::Revert(e) => {
                    ShielderContractErrors::abi_decode(e.output().unwrap(), true).unwrap()
                }
                _ => panic!("Expected EvmRunnerError::Revert"),
            }
        })?;

    let events: Vec<_> = success_result
        .logs
        .iter()
        .map(|log| {
            let event =
                ShielderContractEvents::decode_log(log, true).expect("Decoding event failed");
            assert_eq!(event.address, deployment.contract_suite.shielder);
            event.data
        })
        .collect();
    Ok((events, success_result))
}

pub fn get_balance(deployment: &Deployment, address: &str) -> U256 {
    deployment
        .evm
        .get_balance(Address::from_str(address).unwrap())
        .unwrap()
}

pub fn actor_balance_decreased_by(deployment: &Deployment, amount: U256) -> bool {
    get_balance(deployment, ACTOR_ADDRESS) == ACTOR_INITIAL_BALANCE - amount
}

pub fn recipient_balance_increased_by(deployment: &Deployment, amount: U256) -> bool {
    get_balance(deployment, RECIPIENT_ADDRESS) == RECIPIENT_INITIAL_BALANCE + amount
}

pub fn relayer_balance_increased_by(deployment: &Deployment, amount: U256) -> bool {
    get_balance(deployment, RELAYER_ADDRESS) == RELAYER_INITIAL_BALANCE + amount
}

pub fn destination_balances_unchanged(deployment: &Deployment) -> bool {
    recipient_balance_increased_by(deployment, U256::ZERO)
        && relayer_balance_increased_by(deployment, U256::ZERO)
}
