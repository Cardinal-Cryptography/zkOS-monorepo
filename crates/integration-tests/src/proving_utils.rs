use halo2_proofs::plonk::Circuit;
use powers_of_tau::{get_ptau_file_path, read as read_setup_parameters, Format};
use rand::{RngCore, SeedableRng};
use rstest::fixture;
use shielder_circuits::{
    circuits::{Params, ProvingKey, VerifyingKey},
    deposit::DepositCircuit,
    generate_keys_with_min_k, generate_proof,
    new_account::NewAccountCircuit,
    verify,
    withdraw::WithdrawCircuit,
    ProverKnowledge, F, MAX_K,
};
use shielder_setup::parameter_generation;

/// Given circuit type `C`, construct a correct relation instance and generate a proof, accompanied
/// by the corresponding public input.
pub fn prepare_proof<PK: ProverKnowledge<F>>() -> (Vec<u8>, Vec<F>) {
    let (params, pk, vk, mut rng) = setup::<PK::Circuit>();

    let prover_knowledge = PK::random_correct_example(&mut rng);
    let circuit = prover_knowledge.create_circuit();
    let pub_input = prover_knowledge.serialize_public_input();

    let proof = generate_proof(&params, &pk, circuit, &pub_input, &mut rng);

    // Canary check - should be already covered in other tests.
    verify(&params, &vk, &proof, &pub_input).expect("Verification failed");

    (proof, pub_input)
}

/// Given circuit type `C`, generate params and a proving key.
pub fn prepare_proving_keys<C: Circuit<F> + Default>() -> (Params, ProvingKey) {
    let (params, pk, _, _) = setup::<C>();
    (params, pk)
}

fn setup<C: Circuit<F> + Default>() -> (Params, ProvingKey, VerifyingKey, impl SeedableRng + RngCore)
{
    let full_params = read_setup_parameters(
        get_ptau_file_path(MAX_K, Format::PerpetualPowersOfTau),
        Format::PerpetualPowersOfTau,
    )
    .expect("failed to read parameters from the ptau file");

    let (params, _, pk, vk) =
        generate_keys_with_min_k::<C>(full_params).expect("Key generation failed");

    (params, pk, vk, parameter_generation::rng())
}

pub type ProvingParams = (Params, ProvingKey);

#[fixture]
#[once]
pub fn new_account_proving_params() -> ProvingParams {
    println!("Preparing NewAccount proving keys");
    prepare_proving_keys::<NewAccountCircuit<F>>()
}

#[fixture]
#[once]
pub fn deposit_proving_params() -> ProvingParams {
    println!("Preparing Deposit proving keys");
    prepare_proving_keys::<DepositCircuit<F>>()
}

#[fixture]
#[once]
pub fn withdraw_proving_params() -> ProvingParams {
    println!("Preparing Withdraw proving keys");
    prepare_proving_keys::<WithdrawCircuit<F>>()
}
