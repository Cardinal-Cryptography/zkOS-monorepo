use std::str::FromStr;

use alloy_primitives::{keccak256, Address, Bytes, U256};
use alloy_sol_types::{SolCall, SolConstructor};
use evm_utils::{
    compilation::source_to_bytecode,
    revm_primitives::{AccountInfo, Bytecode},
    EvmRunner,
};
use rstest::{fixture, rstest};
use shielder_rust_sdk::contract::ShielderContract::initializeCall;

use crate::{
    deploy_contract,
    permit2::PERMIT2_BYTECODE,
    proving_utils::{
        deposit_native_proving_params, new_account_native_proving_params,
        withdraw_native_proving_params, ProvingParams,
    },
    read_contract,
    shielder::{
        erc1967proxy::{self, ERC_1967_PROXY_BYTECODE},
        unpause_shielder,
    },
    token,
    verifier::{deploy_verifiers_and_keys, VerificationContracts},
};

/// The address of the deployer account.
///
/// This is one of the default accounts in the Anvil testnet.
pub const DEPLOYER_ADDRESS: &str = "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
pub const DEPLOYER_INITIAL_BALANCE: U256 = U256::MAX;

/// The address of the actor account.
///
/// This is one of the default accounts in the Anvil testnet.
pub const ACTOR_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79C8";
pub const ACTOR_INITIAL_BALANCE: U256 = U256::MAX;

/// The private key of the actor account.
pub const ACTOR_PRIVATE_KEY: &str =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

pub const RECIPIENT_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79C9";
pub const RECIPIENT_INITIAL_BALANCE: U256 = U256::ZERO;

pub const RELAYER_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79CA";
pub const RELAYER_INITIAL_BALANCE: U256 = U256::ZERO;

// Will always revert when receiving funds.
pub const REVERTING_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79CB";
pub const REVERTING_ADDRESS_INITIAL_BALANCE: U256 = U256::ZERO;
pub const REVERTING_BYTECODE: [u8; 4] = [0x60, 0x00, 0x80, 0xfd]; // PUSH1 0x00 DUP1 REVERT

pub const INITIAL_DEPOSIT_LIMIT: U256 = U256::MAX;

/// Contains full deployment addresses.
pub struct ShielderContractSuite {
    pub permit2: Address,
    pub shielder: Address,
    pub token: Address,
}

pub fn prepare_account(
    evm: &mut EvmRunner,
    address: &str,
    balance: U256,
    code: Option<Bytecode>,
) -> Address {
    let caller = Address::from_str(address).unwrap();
    evm.db.insert_account_info(
        caller,
        AccountInfo {
            nonce: 0_u64,
            balance,
            code_hash: keccak256(Bytes::new()),
            code,
        },
    );
    caller
}

pub struct Deployment {
    pub evm: EvmRunner,
    pub contract_suite: ShielderContractSuite,
    pub new_account_native_proving_params: ProvingParams,
    pub deposit_native_proving_params: ProvingParams,
    pub withdraw_native_proving_params: ProvingParams,
}

/// Deploy whole Shielder suite.
#[fixture]
pub fn deployment(
    new_account_native_proving_params: &ProvingParams,
    deposit_native_proving_params: &ProvingParams,
    withdraw_native_proving_params: &ProvingParams,
) -> Deployment {
    let mut evm = EvmRunner::aleph_evm();
    let owner = prepare_account(&mut evm, DEPLOYER_ADDRESS, DEPLOYER_INITIAL_BALANCE, None);
    let actor = prepare_account(&mut evm, ACTOR_ADDRESS, ACTOR_INITIAL_BALANCE, None);
    prepare_account(&mut evm, RECIPIENT_ADDRESS, RECIPIENT_INITIAL_BALANCE, None);
    prepare_account(&mut evm, RELAYER_ADDRESS, RELAYER_INITIAL_BALANCE, None);
    let reverting_bytecode = Bytecode::new_raw(Bytes::from_static(&REVERTING_BYTECODE));
    prepare_account(
        &mut evm,
        REVERTING_ADDRESS,
        REVERTING_ADDRESS_INITIAL_BALANCE,
        Some(reverting_bytecode),
    );

    let poseidon2 = deploy_contract("Poseidon2T8Assembly.sol", "Poseidon2T8Assembly", &mut evm);
    let verification_contracts = deploy_verifiers_and_keys(&mut evm);
    let token = deploy_token(&mut evm, owner);
    let permit2 = deploy_permit2(&mut evm, owner);
    let shielder_address =
        deploy_shielder_contract(poseidon2, verification_contracts, &mut evm, owner);
    unpause_shielder(shielder_address, &mut evm);
    instrument_token(&mut evm, owner, actor, token, permit2);

    Deployment {
        evm,
        contract_suite: ShielderContractSuite {
            token,
            permit2,
            shielder: shielder_address,
        },
        new_account_native_proving_params: new_account_native_proving_params.clone(),
        deposit_native_proving_params: deposit_native_proving_params.clone(),
        withdraw_native_proving_params: withdraw_native_proving_params.clone(),
    }
}

/// Deploy ERC20 token contract
fn deploy_token(evm: &mut EvmRunner, caller: Address) -> Address {
    let solidity_code = read_contract("mocks/Token.sol");
    let compiled_bytecode = source_to_bytecode(solidity_code, "Token", true);

    let constructor_calldata = token::constructor_calldata(U256::from(1000000));
    let calldata = [compiled_bytecode, constructor_calldata].concat();

    evm.create(calldata, Some(caller))
        .expect("Failed to deploy the Token contract")
}

/// Performs basic instrumentation:
/// - Transfer an initial amount of ERC20 to the actor account
/// - Approve Permit2 as spender
fn instrument_token(
    evm: &mut EvmRunner,
    owner: Address,
    actor: Address,
    token: Address,
    permit2: Address,
) {
    evm.call(
        token,
        token::transfer_calldata(actor, U256::from(100000)),
        Some(owner),
        None,
    )
    .expect("ERC20 transfer call failed");

    evm.call(
        token,
        token::approve_calldata(permit2, U256::MAX),
        Some(actor),
        None,
    )
    .expect("ERC20 approve call failed");
}

/// deploy Permit2 contract from a pre-compiled bytecode.
fn deploy_permit2(evm: &mut EvmRunner, caller: Address) -> Address {
    let bytecode = hex::decode(PERMIT2_BYTECODE).expect("Failed to decode permit2 bytecode");
    evm.create(bytecode, Some(caller))
        .expect("Failed to deploy Shielder implementation contract")
}

/// Deploys the Shielder implementation contract.
///
/// This requires more steps than deploying a regular contract because Solc leaves placeholders
/// in the bytecode, which has to be replaced with a deployed Poseidon2 contract address.
fn deploy_shielder_implementation(evm: &mut EvmRunner) -> Address {
    deploy_contract("Shielder.sol", "Shielder", evm)
}

/// Deploy Shielder contract using ERC 1967 proxy.
pub fn deploy_shielder_contract(
    poseidon2_contract: Address,
    verification_contracts: VerificationContracts,
    evm: &mut EvmRunner,
    owner: Address,
) -> Address {
    let implementation_address = deploy_shielder_implementation(evm);
    let initialization_data = initializeCall {
        initialOwner: owner,
        _poseidon2: poseidon2_contract,
        _newAccountVerifier: verification_contracts.new_account_verifier,
        _depositVerifier: verification_contracts.deposit_verifier,
        _withdrawVerifier: verification_contracts.withdraw_verifier,
        _newAccountVerifyingKey: verification_contracts.new_account_vk,
        _depositVerifyingKey: verification_contracts.deposit_vk,
        _withdrawVerifyingKey: verification_contracts.withdraw_vk,
        _depositLimit: INITIAL_DEPOSIT_LIMIT,
    }
    .abi_encode();

    let proxy_bytecode =
        hex::decode(ERC_1967_PROXY_BYTECODE).expect("Failed to decode proxy bytecode");
    let proxy_calldata = [
        proxy_bytecode,
        erc1967proxy::constructorCall {
            implementation: implementation_address,
            _data: Bytes::from(initialization_data),
        }
        .abi_encode(),
    ]
    .concat();

    evm.create(proxy_calldata, Some(owner))
        .expect("Failed to deploy Shielder contract through a proxy")
}

#[rstest]
fn deploy_shielder_suite(_deployment: Deployment) {
    // Deployment successful.
}
