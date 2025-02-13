use std::str::FromStr;

use alloy_primitives::{keccak256, Address, Bytes, U256};
use alloy_sol_types::{SolCall, SolConstructor};
use evm_utils::{
    compilation::source_to_bytecode,
    revm_primitives::{AccountInfo, Bytecode},
    EvmRunner,
};
use rstest::{fixture, rstest};
use shielder_contract::ShielderContract::initializeCall;

use crate::{
    deploy_contract,
    proving_utils::{
        deposit_proving_params, new_account_proving_params, withdraw_proving_params, ProvingParams,
    },
    read_contract,
    shielder::{
        erc1967proxy::{self, ERC_1967_PROXY_BYTECODE},
        unpause_shielder,
    },
    verifier::deploy_verifiers,
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

pub const ANONYMITY_REVOKER_PKEY: U256 = U256::from_limbs([65, 78, 79, 78]); // ANON

/// Contains full deployment addresses.
pub struct ShielderContractSuite {
    pub shielder: Address,
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

/// Solc leaves this placeholder for a Poseidon2 contract address.
const POSEIDON2_LIB_PLACEHOLDER: &str = "__$fa7e1b6d9a16949b5fb8159594c1e0b34c$__";
const NEW_ACCOUNT_VERIFIER_LIB_PLACEHOLDER: &str = "__$96275be2429eed9b26a54836ed89b224a2$__";
const DEPOSIT_VERIFIER_LIB_PLACEHOLDER: &str = "__$d586e7da5a0e0b714a5d44ed4e0f6a624d$__";
const WITHDRAW_VERIFIER_LIB_PLACEHOLDER: &str = "__$06bb88608c3ade14b496e12c6067f182f6$__";

pub struct Deployment {
    pub evm: EvmRunner,
    pub contract_suite: ShielderContractSuite,
    pub new_account_proving_params: ProvingParams,
    pub deposit_proving_params: ProvingParams,
    pub withdraw_proving_params: ProvingParams,
}

/// Deploy whole Shielder suite.
#[fixture]
pub fn deployment(
    new_account_proving_params: &ProvingParams,
    deposit_proving_params: &ProvingParams,
    withdraw_proving_params: &ProvingParams,
) -> Deployment {
    let mut evm = EvmRunner::aleph_evm();
    let owner = prepare_account(&mut evm, DEPLOYER_ADDRESS, DEPLOYER_INITIAL_BALANCE, None);
    prepare_account(&mut evm, ACTOR_ADDRESS, ACTOR_INITIAL_BALANCE, None);
    prepare_account(&mut evm, RECIPIENT_ADDRESS, RECIPIENT_INITIAL_BALANCE, None);
    prepare_account(&mut evm, RELAYER_ADDRESS, RELAYER_INITIAL_BALANCE, None);
    let reverting_bytecode = Bytecode::new_raw(Bytes::from_static(&REVERTING_BYTECODE));
    prepare_account(
        &mut evm,
        REVERTING_ADDRESS,
        REVERTING_ADDRESS_INITIAL_BALANCE,
        Some(reverting_bytecode),
    );

    let shielder_address = deploy_shielder_contract(&mut evm, owner);
    unpause_shielder(shielder_address, &mut evm);

    Deployment {
        evm,
        contract_suite: ShielderContractSuite {
            shielder: shielder_address,
        },
        new_account_proving_params: new_account_proving_params.clone(),
        deposit_proving_params: deposit_proving_params.clone(),
        withdraw_proving_params: withdraw_proving_params.clone(),
    }
}

/// Deploys the Shielder implementation contract.
///
/// This requires more steps than deploying a regular contract because Solc leaves placeholders
/// in the bytecode, which has to be replaced with a deployed Poseidon2 contract address.
fn deploy_shielder_implementation(evm: &mut EvmRunner) -> Address {
    // 1. Compile the Shielder implementation contract. It will contain placeholders.
    let solidity_code = read_contract("Shielder.sol");
    let implementation_bytecode = source_to_bytecode(solidity_code, "Shielder", false);

    // 2. Compile and deploy auxiliary contracts.
    let poseidon2_address =
        deploy_contract("Poseidon2T8Assembly.sol", "Poseidon2T8Assembly", evm).to_string();

    let verifiers = deploy_verifiers(evm);

    // 3. Manipulate the Shielder implementation bytecode to replace the placeholders with the
    //    corresponding contract addresses.
    let implementation_bytecode = String::from_utf8(implementation_bytecode).unwrap();
    let with_linked_libs = implementation_bytecode
        .replace(
            POSEIDON2_LIB_PLACEHOLDER,
            poseidon2_address.strip_prefix("0x").unwrap(),
        )
        .replace(
            NEW_ACCOUNT_VERIFIER_LIB_PLACEHOLDER,
            verifiers
                .new_account_verifier
                .to_string()
                .strip_prefix("0x")
                .unwrap(),
        )
        .replace(
            DEPOSIT_VERIFIER_LIB_PLACEHOLDER,
            verifiers
                .deposit_verifier
                .to_string()
                .strip_prefix("0x")
                .unwrap(),
        )
        .replace(
            WITHDRAW_VERIFIER_LIB_PLACEHOLDER,
            verifiers
                .withdraw_verifier
                .to_string()
                .strip_prefix("0x")
                .unwrap(),
        );
    let ready_bytecode = hex::decode(with_linked_libs).unwrap();

    // 4. Finally, deploy the Shielder implementation contract.
    evm.create(ready_bytecode, None)
        .expect("Failed to deploy Shielder implementation contract")
}

/// Deploy Shielder contract using ERC 1967 proxy.
pub fn deploy_shielder_contract(evm: &mut EvmRunner, owner: Address) -> Address {
    let implementation_address = deploy_shielder_implementation(evm);
    let initialization_data = initializeCall {
        initialOwner: owner,
        _depositLimit: INITIAL_DEPOSIT_LIMIT,
        _anonymityRevokerPublicKey: ANONYMITY_REVOKER_PKEY,
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
