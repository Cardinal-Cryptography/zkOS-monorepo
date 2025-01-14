use std::{fs::File, io::Write, path::PathBuf, str};

use halo2_proofs::{
    halo2curves::bn256::{Bn256, Fr},
    poly::kzg::commitment::ParamsKZG,
};
use halo2_solidity_verifier::{BatchOpenScheme::Bdfg21, SolidityGenerator};
use powers_of_tau::{get_ptau_file_path, read as read_setup_parameters, Format};
use shielder_circuits::{
    circuits::{generate_keys_with_min_k, Params},
    consts::RANGE_PROOF_CHUNK_SIZE,
    deposit::DepositProverKnowledge,
    new_account::NewAccountProverKnowledge,
    withdraw::WithdrawProverKnowledge,
    EnumCount, ProverKnowledge, MAX_K,
};

const CONTRACTS_DIR: &str = "./contracts";

pub fn main() {
    let full_parameters = read_setup_parameters(
        get_ptau_file_path(MAX_K, Format::PerpetualPowersOfTau),
        Format::PerpetualPowersOfTau,
    )
    .expect("failed to read parameters from the ptau file");

    handle_relation::<NewAccountProverKnowledge<Fr>>(full_parameters.clone(), "NewAccount");
    handle_relation::<DepositProverKnowledge<Fr, RANGE_PROOF_CHUNK_SIZE>>(
        full_parameters.clone(),
        "Deposit",
    );
    handle_relation::<WithdrawProverKnowledge<Fr, RANGE_PROOF_CHUNK_SIZE>>(
        full_parameters,
        "Withdraw",
    );
}

/// Generate verifier contract for the given circuit type.
fn handle_relation<PK: ProverKnowledge<Fr>>(full_params: Params, relation: &str) {
    println!("Generating {relation} relation contracts...");
    let verifier_solidity = generate_solidity_verification_bundle::<PK>(full_params);
    save_contract_source(&format!("{relation}Verifier.sol"), &verifier_solidity);
}

/// Given trusted setup, generate Solidity code for the verifier with embedded verification key.
fn generate_solidity_verification_bundle<PK: ProverKnowledge<Fr>>(
    full_parameters: ParamsKZG<Bn256>,
) -> String {
    let (parameters, _, _, vk) =
        generate_keys_with_min_k::<PK::Circuit>(full_parameters).expect("Failed to generate keys");
    SolidityGenerator::new(&parameters, &vk, Bdfg21, PK::PublicInput::COUNT)
        .render()
        .expect("Failed to generate separate contracts")
}

/// Writes solidity source code to the file under `CONTRACTS_DIR` directory.
fn save_contract_source(filename: &str, solidity: &str) {
    let path = PathBuf::from(format!("{CONTRACTS_DIR}/{filename}"));
    File::create(path)
        .unwrap()
        .write_all(solidity.as_bytes())
        .expect("Can write to file");
}

#[cfg(test)]
mod test {
    use alloy_primitives::Address;
    use alloy_sol_types::SolValue;
    use evm_utils::{compilation::source_to_bytecode, EvmRunner, EvmRunnerError, SuccessResult};
    use halo2_proofs::halo2curves::bn256::Fr;
    use halo2_solidity_verifier::verifier_contract;
    use shielder_circuits::{
        circuits::{generate_proof, generate_setup_params},
        consts::{MAX_K, RANGE_PROOF_CHUNK_SIZE},
        deposit::DepositProverKnowledge,
        generate_keys_with_min_k,
        new_account::NewAccountProverKnowledge,
        withdraw::WithdrawProverKnowledge,
        ProverKnowledge,
    };
    use shielder_rust_sdk::parameter_generation::rng;

    use crate::generate_solidity_verification_bundle;

    // constants to safeguard against regressions, 110% of MEASURED_GAS
    pub const NEW_ACCOUNT_VERIFICATION_GAS_COST: u64 = 706212; //1.1 * 642011;
    pub const DEPOSIT_VERIFICATION_GAS_COST: u64 = 914940; //1.1 * 831764;
    pub const WITHDRAW_VERIFICATION_GAS_COST: u64 = 1017855; //1.1 * 925323;

    fn deploy_source_code(source: &str, contract_name: &str, evm: &mut EvmRunner) -> Address {
        let bytecode = source_to_bytecode(source, contract_name, true);
        evm.create(bytecode, None)
            .expect("Contract can be deployed")
    }

    /// Verify proof and return the gas used
    ///
    /// Return an error if verifier fails on-chain.
    fn verify_with_contract(
        verifier_solidity: &str,
        proof: &[u8],
        public_input: &[Fr],
    ) -> Result<u64, EvmRunnerError> {
        let mut evm = EvmRunner::aleph_evm();

        // Deploy verifier and vk contracts
        let verifier_address = deploy_source_code(verifier_solidity, "Halo2Verifier", &mut evm);

        // Call verifier contract
        let calldata = verifier_contract::encode_calldata(proof, public_input);
        match evm.call(verifier_address, calldata, None, None) {
            Ok(SuccessResult {
                gas_used, output, ..
            }) => {
                println!("Gas cost of verifying: {gas_used}");
                assert!(<bool>::abi_decode(&output, true).unwrap());
                Ok(gas_used)
            }
            Err(why) => Err(why),
        }
    }

    // Generate proof for an example relation instance and verify it with the Solidity contract.
    fn prove_and_verify<PK: ProverKnowledge<Fr>>(cost_upper_bound: u64) {
        let mut rng = rng();
        let full_parameters = generate_setup_params(MAX_K, &mut rng);
        let prover_knowledge = PK::random_correct_example(&mut rng);
        let public_input = prover_knowledge.serialize_public_input();

        let verifier_solidity =
            generate_solidity_verification_bundle::<PK>(full_parameters.clone());

        let (parameters, _, pk, _) =
            generate_keys_with_min_k::<PK::Circuit>(full_parameters).unwrap();
        let circuit = prover_knowledge.create_circuit();
        let proof = generate_proof(&parameters, &pk, circuit, &public_input, &mut rng);

        let result = verify_with_contract(&verifier_solidity, &proof, &public_input);
        assert!(result.is_ok());
        assert!(result.unwrap() <= cost_upper_bound);
    }

    #[test]
    fn prove_and_verify_new_account() {
        prove_and_verify::<NewAccountProverKnowledge<Fr>>(NEW_ACCOUNT_VERIFICATION_GAS_COST);
    }

    #[test]
    fn prove_and_verify_deposit() {
        prove_and_verify::<DepositProverKnowledge<Fr, RANGE_PROOF_CHUNK_SIZE>>(
            DEPOSIT_VERIFICATION_GAS_COST,
        );
    }

    #[test]
    fn prove_and_verify_withdraw() {
        prove_and_verify::<WithdrawProverKnowledge<Fr, RANGE_PROOF_CHUNK_SIZE>>(
            WITHDRAW_VERIFICATION_GAS_COST,
        );
    }
}
