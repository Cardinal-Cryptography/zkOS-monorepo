use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolValue};
use evm_utils::EvmRunner;
use shielder_contract::ShielderContract::{protocolDepositFeeBpsCall, protocolWithdrawFeeBpsCall};

pub struct ProtocolFeesBps {
    pub protocol_deposit_fee_bps: U256,
    pub protocol_withdraw_fee_bps: U256,
}

pub fn get_protocol_deposit_fee_bps(shielder_address: Address, evm: &mut EvmRunner) -> U256 {
    let calldata = protocolDepositFeeBpsCall {}.abi_encode();
    let result = evm
        .call(shielder_address, calldata, None, None)
        .expect("Call failed")
        .output;
    U256::abi_decode(&result, true).expect("Decoding failed")
}

pub fn get_protocol_withdraw_fee_bps(shielder_address: Address, evm: &mut EvmRunner) -> U256 {
    let calldata = protocolWithdrawFeeBpsCall {}.abi_encode();
    let result = evm
        .call(shielder_address, calldata, None, None)
        .expect("Call failed")
        .output;
    U256::abi_decode(&result, true).expect("Decoding failed")
}
