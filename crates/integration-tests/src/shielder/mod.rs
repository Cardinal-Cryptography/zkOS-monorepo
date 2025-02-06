use std::str::FromStr;

use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolEventInterface, SolInterface};
use deploy::{
    Deployment, ACTOR_ADDRESS, ACTOR_INITIAL_FAKE_TOKEN_BALANCE, ACTOR_INITIAL_NATIVE_BALANCE,
    DEPLOYER_ADDRESS, RECIPIENT_ADDRESS, RECIPIENT_INITIAL_FAKE_TOKEN_BALANCE,
    RECIPIENT_INITIAL_NATIVE_BALANCE, RELAYER_ADDRESS, RELAYER_INITIAL_FAKE_TOKEN_BALANCE,
    RELAYER_INITIAL_NATIVE_BALANCE,
};
use evm_utils::{EvmRunner, EvmRunnerError, SuccessResult};
use ierc20::IERC20::IERC20Events;
use shielder_contract::ShielderContract::{
    unpauseCall, ShielderContractErrors, ShielderContractEvents,
};

pub mod address_conversion;
pub mod calls;
pub mod deploy;
pub mod erc1967proxy;
pub mod fake_token;
pub mod ierc20;
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

// Calls Shielder. If successful, returns the events emitted by the Shielder contract,
// filtering out any other emitted events. If unsuccessful, returns the revert code.
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
        .filter_map(|log| {
            let shielder_event = ShielderContractEvents::decode_log(log, true);
            if let Ok(shielder_event) = shielder_event {
                assert_eq!(shielder_event.address, deployment.contract_suite.shielder);
                return Some(shielder_event.data);
            }

            // Expect ERC20 event and ignore it.
            let erc20_event = IERC20Events::decode_log(log, true);
            assert!(erc20_event.is_ok());
            None
        })
        .collect();
    Ok((events, success_result))
}

#[derive(Copy, Clone)]
pub enum TestToken {
    Native,
    FakeERC20,
}

impl TestToken {
    fn address(self, deployment: &Deployment) -> Address {
        match self {
            TestToken::Native => Address::ZERO,
            TestToken::FakeERC20 => deployment.fake_token.contract_address,
        }
    }
}

pub fn get_balance(deployment: &Deployment, token: TestToken, address: &str) -> U256 {
    let address = Address::from_str(address).unwrap();

    match token {
        TestToken::Native => deployment.evm.get_balance(address).unwrap(),
        TestToken::FakeERC20 => deployment
            .fake_token
            .get_balance(&deployment.evm, address)
            .unwrap(),
    }
}

pub fn actor_balance_decreased_by(deployment: &Deployment, token: TestToken, amount: U256) -> bool {
    let initial_balance = match token {
        TestToken::Native => ACTOR_INITIAL_NATIVE_BALANCE,
        TestToken::FakeERC20 => ACTOR_INITIAL_FAKE_TOKEN_BALANCE,
    };
    get_balance(deployment, token, ACTOR_ADDRESS) == initial_balance - amount
}

pub fn recipient_balance_increased_by(
    deployment: &Deployment,
    token: TestToken,
    amount: U256,
) -> bool {
    let initial_balance = match token {
        TestToken::Native => RECIPIENT_INITIAL_NATIVE_BALANCE,
        TestToken::FakeERC20 => RECIPIENT_INITIAL_FAKE_TOKEN_BALANCE,
    };
    get_balance(deployment, token, RECIPIENT_ADDRESS) == initial_balance + amount
}

pub fn relayer_balance_increased_by(
    deployment: &Deployment,
    token: TestToken,
    amount: U256,
) -> bool {
    let initial_balance = match token {
        TestToken::Native => RELAYER_INITIAL_NATIVE_BALANCE,
        TestToken::FakeERC20 => RELAYER_INITIAL_FAKE_TOKEN_BALANCE,
    };
    get_balance(deployment, token, RELAYER_ADDRESS) == initial_balance + amount
}

pub fn destination_balances_unchanged(deployment: &Deployment, token: TestToken) -> bool {
    recipient_balance_increased_by(deployment, token, U256::ZERO)
        && relayer_balance_increased_by(deployment, token, U256::ZERO)
}
