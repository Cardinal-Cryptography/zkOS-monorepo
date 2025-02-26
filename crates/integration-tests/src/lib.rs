#![feature(assert_matches)]

use std::{env, fs::File, io::Read};

use alloy_primitives::Address;
use evm_utils::{compilation::source_to_bytecode, EvmRunner};

mod poseidon2;
mod proving_utils;
mod shielder;
mod verifier;

pub use proving_utils::*;
pub use shielder::*;

fn read_contract(contract_name: &str) -> String {
    let mut contents = String::new();

    let mut file = File::open(format!(
        "{}/{contract_name}",
        env::var("CONTRACTS_DIR").unwrap_or(String::from("../../contracts"))
    ))
    .expect("Cannot open contract source file");
    file.read_to_string(&mut contents)
        .expect("Cannot read contract source file");
    contents
}

fn deploy_contract(contract_filename: &str, contract_name: &str, evm: &mut EvmRunner) -> Address {
    deploy_contract_with_caller(contract_filename, contract_name, None, evm)
}

// Allows to deploy a contract while specifying the address that performs the deployment.
fn deploy_contract_with_caller(
    contract_filename: &str,
    contract_name: &str,
    caller: Option<Address>,
    evm: &mut EvmRunner,
) -> Address {
    let solidity_code = read_contract(contract_filename);
    let compiled_bytecode = source_to_bytecode(solidity_code, contract_name, true);
    evm.create(compiled_bytecode, caller)
        .unwrap_or_else(|_| panic!("Failed to deploy {contract_name} contract"))
}
