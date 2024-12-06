use alloy_primitives::Address;
use alloy_sol_types::SolValue;
use evm_utils::EvmRunner;
use halo2_proofs::halo2curves::bn256::Fr;
use halo2_solidity_verifier::verifier_contract;
use shielder_circuits::{
    consts::RANGE_PROOF_CHUNK_SIZE, deposit::DepositProverKnowledge,
    new_account::NewAccountProverKnowledge, withdraw::WithdrawProverKnowledge, F,
};

use crate::{deploy_contract, proving_utils};

const VERIFIER_CONTRACT_NAME: &str = "Halo2Verifier";

#[derive(Copy, Clone)]
pub struct VerificationContracts {
    pub new_account_verifier: Address,
    pub deposit_verifier: Address,
    pub withdraw_verifier: Address,
}

pub fn deploy_verifiers(evm: &mut EvmRunner) -> VerificationContracts {
    let new_account_verifier =
        deploy_contract("NewAccountVerifier.sol", VERIFIER_CONTRACT_NAME, evm);
    let deposit_verifier = deploy_contract("DepositVerifier.sol", VERIFIER_CONTRACT_NAME, evm);
    let withdraw_verifier = deploy_contract("WithdrawVerifier.sol", VERIFIER_CONTRACT_NAME, evm);

    VerificationContracts {
        new_account_verifier,
        deposit_verifier,
        withdraw_verifier,
    }
}

#[test]
fn deploy_verification_contracts() {
    deploy_verifiers(&mut EvmRunner::aleph_evm());
}

fn verify_with_contract(
    proof: Vec<u8>,
    pub_input: Vec<F>,
    verifier_address: Address,
    evm: &mut EvmRunner,
) -> bool {
    let calldata = verifier_contract::encode_calldata(&proof, &pub_input);
    let response = evm
        .call(verifier_address, calldata, None, None)
        .expect("Call failed")
        .output;
    <bool>::abi_decode(&response, true).expect("Decoding contract response failed")
}

#[test]
fn new_account_contract_verification_works() {
    let mut evm = EvmRunner::aleph_evm();
    let verification_contracts = deploy_verifiers(&mut evm);

    let (proof, pub_input) = proving_utils::prepare_proof::<NewAccountProverKnowledge<F>>();
    assert!(verify_with_contract(
        proof,
        pub_input,
        verification_contracts.new_account_verifier,
        &mut evm,
    ));
}

#[test]
fn deposit_contract_verification_works() {
    let mut evm = EvmRunner::aleph_evm();
    let verification_contracts = deploy_verifiers(&mut evm);

    let (proof, pub_input) =
        proving_utils::prepare_proof::<DepositProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>>();
    assert!(verify_with_contract(
        proof,
        pub_input,
        verification_contracts.deposit_verifier,
        &mut evm,
    ));
}

#[test]
fn withdraw_contract_verification_works() {
    let mut evm = EvmRunner::aleph_evm();
    let verification_contracts = deploy_verifiers(&mut evm);

    let (proof, pub_input) =
        proving_utils::prepare_proof::<WithdrawProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>>();
    assert!(verify_with_contract(
        proof,
        pub_input,
        verification_contracts.withdraw_verifier,
        &mut evm,
    ));
}

// Should trigger an early return in `Halo2Verifier`.
#[test]
fn fails_on_empty_proof() {
    let mut evm = EvmRunner::aleph_evm();
    let verification_contracts = deploy_verifiers(&mut evm);

    assert!(!verify_with_contract(
        vec![],
        vec![],
        verification_contracts.new_account_verifier,
        &mut evm,
    ));
}

// Should trigger a late return in `Halo2Verifier`.
#[test]
fn fails_on_proof_with_wrong_input() {
    let mut evm = EvmRunner::aleph_evm();
    let verification_contracts = deploy_verifiers(&mut evm);

    let (proof, mut pub_input) = proving_utils::prepare_proof::<NewAccountProverKnowledge<F>>();
    pub_input[0] += Fr::from(1);

    assert!(!verify_with_contract(
        proof,
        pub_input,
        verification_contracts.new_account_verifier,
        &mut evm,
    ));
}

// Should trigger a late return in `Halo2Verifier`.
#[test]
fn fails_on_corrupted_proof() {
    let mut evm = EvmRunner::aleph_evm();
    let verification_contracts = deploy_verifiers(&mut evm);

    let (mut proof, pub_input) = proving_utils::prepare_proof::<NewAccountProverKnowledge<F>>();
    proof[0] = proof[0].wrapping_add(1u8);

    assert!(!verify_with_contract(
        proof,
        pub_input,
        verification_contracts.new_account_verifier,
        &mut evm,
    ));
}
