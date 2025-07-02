use std::str::FromStr;

use alloy_primitives::{keccak256, Address, Bytes, U256};
use alloy_sol_types::{SolCall, SolConstructor};
use evm_utils::{
    compilation::source_to_bytecode,
    revm_primitives::{AccountInfo, Bytecode},
    EvmRunner,
};
use rstest::fixture;
use shielder_circuits::GrumpkinPointAffine;
use shielder_contract::ShielderContract::initializeCall;

use crate::{
    deploy_contract,
    erc20::TestERC20,
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

pub const TEST_ERC20_FAUCET_ADDRESS: &str = "9999999999999999999999999999999999999999";

/// The address of the deployer account.
///
/// This is one of the default accounts in the Anvil testnet.
pub const DEPLOYER_ADDRESS: &str = "f39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
pub const DEPLOYER_INITIAL_NATIVE_BALANCE: U256 = U256::MAX;
pub const DEPLOYER_INITIAL_ERC20_BALANCE: U256 = U256::ZERO;

/// The address of the protocol fee receiver account..
pub const PROTOCOL_FEE_RECEIVER_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79CB";
pub const PROTOCOL_FEE_RECEIVER_INITIAL_NATIVE_BALANCE: U256 = U256::ZERO;
pub const PROTOCOL_FEE_RECEIVER_INITIAL_ERC20_BALANCE: U256 = U256::ZERO;

/// The address of the actor account.
///
/// This is one of the default accounts in the Anvil testnet.
pub const ACTOR_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79C8";
pub const ACTOR_INITIAL_NATIVE_BALANCE: U256 = U256::MAX;
pub const ACTOR_INITIAL_ERC20_BALANCE: U256 = U256::MAX;

/// The private key of the actor account.
pub const ACTOR_PRIVATE_KEY: &str =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

pub const RECIPIENT_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79C9";
pub const RECIPIENT_INITIAL_NATIVE_BALANCE: U256 = U256::ZERO;
pub const RECIPIENT_INITIAL_ERC20_BALANCE: U256 = U256::ZERO;

pub const RELAYER_ADDRESS: &str = "70997970C51812dc3A010C7d01b50e0d17dc79CA";
pub const RELAYER_INITIAL_NATIVE_BALANCE: U256 = U256::ZERO;
pub const RELAYER_INITIAL_ERC20_BALANCE: U256 = U256::ZERO;

// Will always revert when receiving funds.
pub const REVERTING_ADDRESS: &str = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
pub const REVERTING_ADDRESS_INITIAL_NATIVE_BALANCE: U256 = U256::ZERO;
pub const REVERTING_BYTECODE: [u8; 4] = [0x60, 0x00, 0x80, 0xfd]; // PUSH1 0x00 DUP1 REVERT

pub const ANONYMITY_REVOKER_PKEY: GrumpkinPointAffine<U256> = GrumpkinPointAffine {
    x: U256::from_limbs([1, 0, 0, 0]),
    y: U256::from_limbs([
        9457493854555940652,
        3253583849847263892,
        14921373847124204899,
        2,
    ]),
};

/// Contains full deployment addresses.
pub struct ShielderContractSuite {
    pub shielder: Address,
}

pub fn prepare_account(
    evm: &mut EvmRunner,
    test_erc20: &TestERC20,
    address: &str,
    native_balance: U256,
    erc20_balance: Option<U256>,
    code: Option<Bytecode>,
) -> Address {
    let address = Address::from_str(address).unwrap();

    evm.db.insert_account_info(
        address,
        AccountInfo {
            nonce: 0_u64,
            balance: native_balance,
            code_hash: keccak256(Bytes::new()),
            code,
        },
    );

    if let Some(balance) = erc20_balance {
        test_erc20.faucet(evm, address, balance).unwrap()
    }

    address
}

/// Solc leaves this placeholder for a Poseidon2 contract address.
const POSEIDON2_LIB_PLACEHOLDER: &str = "__$fa7e1b6d9a16949b5fb8159594c1e0b34c$__";
const NEW_ACCOUNT_VERIFIER_LIB_PLACEHOLDER: &str = "__$96275be2429eed9b26a54836ed89b224a2$__";
const DEPOSIT_VERIFIER_LIB_PLACEHOLDER: &str = "__$d586e7da5a0e0b714a5d44ed4e0f6a624d$__";
const WITHDRAW_VERIFIER_LIB_PLACEHOLDER: &str = "__$06bb88608c3ade14b496e12c6067f182f6$__";

pub struct Deployment {
    pub evm: EvmRunner,
    pub test_erc20: TestERC20,
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

    let test_erc20 = TestERC20::deploy(
        &mut evm,
        Address::from_str(TEST_ERC20_FAUCET_ADDRESS).unwrap(),
    );

    let owner = prepare_account(
        &mut evm,
        &test_erc20,
        DEPLOYER_ADDRESS,
        DEPLOYER_INITIAL_NATIVE_BALANCE,
        Some(DEPLOYER_INITIAL_ERC20_BALANCE),
        None,
    );
    prepare_account(
        &mut evm,
        &test_erc20,
        ACTOR_ADDRESS,
        ACTOR_INITIAL_NATIVE_BALANCE,
        Some(ACTOR_INITIAL_ERC20_BALANCE),
        None,
    );
    prepare_account(
        &mut evm,
        &test_erc20,
        RECIPIENT_ADDRESS,
        RECIPIENT_INITIAL_NATIVE_BALANCE,
        Some(RECIPIENT_INITIAL_ERC20_BALANCE),
        None,
    );
    prepare_account(
        &mut evm,
        &test_erc20,
        RELAYER_ADDRESS,
        RELAYER_INITIAL_NATIVE_BALANCE,
        Some(RELAYER_INITIAL_ERC20_BALANCE),
        None,
    );
    let reverting_bytecode = Bytecode::new_raw(Bytes::from_static(&REVERTING_BYTECODE));
    prepare_account(
        &mut evm,
        &test_erc20,
        REVERTING_ADDRESS,
        REVERTING_ADDRESS_INITIAL_NATIVE_BALANCE,
        None, // Cannot transfer to this address because the testing token will revert.
        Some(reverting_bytecode),
    );

    let shielder_address = deploy_shielder_contract(
        &mut evm,
        owner,
        ANONYMITY_REVOKER_PKEY,
        U256::ZERO,
        U256::ZERO,
        Address::from_str(PROTOCOL_FEE_RECEIVER_ADDRESS).unwrap(),
    );
    unpause_shielder(shielder_address, &mut evm);

    Deployment {
        evm,
        test_erc20,
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
fn deploy_shielder_contract(
    evm: &mut EvmRunner,
    owner: Address,
    ar_key: GrumpkinPointAffine<U256>,
    protocol_deposit_fee_bps: U256,
    protocol_withdraw_fee_bps: U256,
    protocol_fee_receiver: Address,
) -> Address {
    let implementation_address = deploy_shielder_implementation(evm);
    let initialization_data = initializeCall {
        initialOwner: owner,
        _anonymityRevokerPublicKeyX: ar_key.x,
        _anonymityRevokerPublicKeyY: ar_key.y,
        _isArbitrumChain: false,
        _protocolDepositFeeBps: protocol_deposit_fee_bps,
        _protocolWithdrawFeeBps: protocol_withdraw_fee_bps,
        _protocolFeeReceiver: protocol_fee_receiver,
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

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use alloy_primitives::{keccak256, Address, Bytes, U256};
    use evm_utils::{revm_primitives::AccountInfo, EvmRunner};
    use rstest::rstest;
    use shielder_circuits::GrumpkinPointAffine;

    use crate::deploy::{
        deploy_shielder_contract, deployment, Deployment, ANONYMITY_REVOKER_PKEY, DEPLOYER_ADDRESS,
        DEPLOYER_INITIAL_NATIVE_BALANCE, PROTOCOL_FEE_RECEIVER_ADDRESS,
    };

    #[rstest]
    fn full_deployment_works(_deployment: Deployment) {
        // Deployment successful.
    }

    #[test]
    fn minimal_shielder_contract_deployment_works() {
        let mut evm = EvmRunner::aleph_evm();

        let owner = Address::from_str(DEPLOYER_ADDRESS).unwrap();

        evm.db.insert_account_info(
            owner,
            AccountInfo {
                nonce: 0_u64,
                balance: DEPLOYER_INITIAL_NATIVE_BALANCE,
                code_hash: keccak256(Bytes::new()),
                code: None,
            },
        );

        deploy_shielder_contract(
            &mut evm,
            owner,
            ANONYMITY_REVOKER_PKEY,
            U256::ZERO,
            U256::ZERO,
            Address::from_str(PROTOCOL_FEE_RECEIVER_ADDRESS).unwrap(),
        );
    }

    #[test]
    #[should_panic(expected = "Failed to deploy Shielder contract")]
    fn deployment_fails_when_ar_key_is_not_on_curve() {
        let mut evm = EvmRunner::aleph_evm();

        let owner = Address::from_str(DEPLOYER_ADDRESS).unwrap();

        evm.db.insert_account_info(
            owner,
            AccountInfo {
                nonce: 0_u64,
                balance: DEPLOYER_INITIAL_NATIVE_BALANCE,
                code_hash: keccak256(Bytes::new()),
                code: None,
            },
        );

        deploy_shielder_contract(
            &mut evm,
            owner,
            GrumpkinPointAffine {
                x: U256::from(0),
                y: U256::from(1),
            },
            U256::ZERO,
            U256::ZERO,
            Address::from_str(PROTOCOL_FEE_RECEIVER_ADDRESS).unwrap(),
        );
    }

    #[test]
    #[should_panic(expected = "Failed to deploy Shielder contract")]
    fn deployment_fails_when_ar_coordinates_are_not_from_field() {
        let mut evm = EvmRunner::aleph_evm();

        let owner = Address::from_str(DEPLOYER_ADDRESS).unwrap();

        evm.db.insert_account_info(
            owner,
            AccountInfo {
                nonce: 0_u64,
                balance: DEPLOYER_INITIAL_NATIVE_BALANCE,
                code_hash: keccak256(Bytes::new()),
                code: None,
            },
        );

        let field_modulus = U256::from_str(
            "21888242871839275222246405745257275088548364400416034343698204186575808495617",
        )
        .unwrap();

        deploy_shielder_contract(
            &mut evm,
            owner,
            GrumpkinPointAffine {
                x: ANONYMITY_REVOKER_PKEY.x + field_modulus,
                ..ANONYMITY_REVOKER_PKEY
            },
            U256::ZERO,
            U256::ZERO,
            Address::from_str(PROTOCOL_FEE_RECEIVER_ADDRESS).unwrap(),
        );
    }
}
