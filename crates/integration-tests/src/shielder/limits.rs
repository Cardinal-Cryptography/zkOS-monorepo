use std::str::FromStr;

use alloy_primitives::U256;
use alloy_sol_types::{SolCall, SolValue};
use shielder_contract::ShielderContract::{depositLimitCall, setDepositLimitCall};

use super::deploy::DEPLOYER_ADDRESS;
use crate::{shielder::deploy::Deployment, Address};

pub fn set_deposit_limit(deployment: &mut Deployment, token_address: Address, limit: U256) {
    let calldata = setDepositLimitCall {
        tokenAddress: token_address,
        _depositLimit: limit,
    }
    .abi_encode();

    deployment
        .evm
        .call(
            deployment.contract_suite.shielder,
            calldata,
            Some(Address::from_str(DEPLOYER_ADDRESS).unwrap()),
            None,
        )
        .expect("Call failed");
}

pub fn get_deposit_limit(deployment: &mut Deployment) -> U256 {
    let calldata = depositLimitCall {}.abi_encode();
    let encoded_limit = deployment
        .evm
        .call(deployment.contract_suite.shielder, calldata, None, None)
        .expect("Call failed")
        .output;
    <U256>::abi_decode(&encoded_limit, true).expect("Decoding failed")
}
