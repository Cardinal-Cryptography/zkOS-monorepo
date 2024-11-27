use alloy_primitives::{Address, U256};
use alloy_sol_types::{sol, SolCall, SolConstructor};

sol! {
    constructor(uint256 initialSupply);

    function approve(address spender, uint256 value) external returns (bool);

    function transfer(address to, uint256 value) external returns (bool);
}

pub fn constructor_calldata(initial_supply: U256) -> Vec<u8> {
    constructorCall {
        initialSupply: initial_supply,
    }
    .abi_encode()
}

pub fn approve_calldata(spender: Address, value: U256) -> Vec<u8> {
    approveCall { spender, value }.abi_encode()
}

pub fn transfer_calldata(to: Address, value: U256) -> Vec<u8> {
    transferCall { to, value }.abi_encode()
}
