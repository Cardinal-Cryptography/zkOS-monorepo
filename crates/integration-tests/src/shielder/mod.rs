use std::{fmt, str::FromStr};

use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolEventInterface};
use call_errors::{decode_call_errors, ShielderCallErrors};
use deploy::{
    Deployment, ACTOR_ADDRESS, ACTOR_INITIAL_ERC20_BALANCE, ACTOR_INITIAL_NATIVE_BALANCE,
    DEPLOYER_ADDRESS, RECIPIENT_ADDRESS, RECIPIENT_INITIAL_ERC20_BALANCE,
    RECIPIENT_INITIAL_NATIVE_BALANCE, RELAYER_ADDRESS, RELAYER_INITIAL_ERC20_BALANCE,
    RELAYER_INITIAL_NATIVE_BALANCE,
};
use evm_utils::{EvmRunner, EvmRunnerError, SuccessResult};
use shielder_account::call_data::Token;
use shielder_contract::ShielderContract::{unpauseCall, ShielderContractEvents};

pub mod address_conversion;
pub mod call_errors;
pub mod calls;
pub mod deploy;
pub mod erc1967proxy;
pub mod erc20;
pub mod ierc20;
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

type CallResult = Result<(Vec<ShielderContractEvents>, SuccessResult), ShielderCallErrors>;

// Calls Shielder. If successful, returns *just the events emitted by the Shielder contract*,
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
                EvmRunnerError::Revert(e) => decode_call_errors(e.output().unwrap()),
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
            None
        })
        .collect();
    Ok((events, success_result))
}

/// Represents the token under test. Doesn't store the token address, as opposed to
/// `shielder-account::call_data::Token`, because the token address is not known at compile time.
///
/// `TestToken` is convertible to `Token` via `token()`.
#[derive(Copy, Clone)]
pub enum TestToken {
    Native,
    ERC20,
}

impl TestToken {
    pub fn address(self, deployment: &Deployment) -> Address {
        match self {
            TestToken::Native => Address::ZERO,
            TestToken::ERC20 => deployment.test_erc20.contract_address,
        }
    }

    pub fn token(self, deployment: &Deployment) -> Token {
        match self {
            TestToken::Native => Token::Native,
            TestToken::ERC20 => Token::ERC20(deployment.test_erc20.contract_address),
        }
    }
}

impl fmt::Display for TestToken {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Self::Native => write!(f, "Native"),
            Self::ERC20 => write!(f, "ERC20"),
        }
    }
}

fn get_balance(deployment: &Deployment, token: TestToken, address: &str) -> U256 {
    let address = Address::from_str(address).unwrap();

    match token {
        TestToken::Native => deployment.evm.get_balance(address).unwrap(),
        TestToken::ERC20 => deployment
            .test_erc20
            .get_balance(&deployment.evm, address)
            .unwrap(),
    }
}

pub fn actor_balance_decreased_by(deployment: &Deployment, token: TestToken, amount: U256) -> bool {
    let initial_balance = match token {
        TestToken::Native => ACTOR_INITIAL_NATIVE_BALANCE,
        TestToken::ERC20 => ACTOR_INITIAL_ERC20_BALANCE,
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
        TestToken::ERC20 => RECIPIENT_INITIAL_ERC20_BALANCE,
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
        TestToken::ERC20 => RELAYER_INITIAL_ERC20_BALANCE,
    };
    get_balance(deployment, token, RELAYER_ADDRESS) == initial_balance + amount
}

pub fn destination_balances_unchanged(deployment: &Deployment, token: TestToken) -> bool {
    recipient_balance_increased_by(deployment, token, U256::ZERO)
        && relayer_balance_increased_by(deployment, token, U256::ZERO)
}
