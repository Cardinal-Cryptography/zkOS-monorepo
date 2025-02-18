//! This script builds artifacts, which are later
//! embedded into the wasm binary.
//! To speedup the build process, we cache the artifacts after the first build.
//!
//! When working locally, the `artifacts/` directory should be cleaned after the circuits are changed.
use powers_of_tau::{get_ptau_file_path, read as read_setup_parameters, Format};
use shielder_circuits::{
    circuits::Params,
    deposit::DepositCircuit,
    generate_keys_with_min_k,
    marshall::{marshall_params, marshall_pk},
    new_account::NewAccountCircuit,
    withdraw::WithdrawCircuit,
    Circuit, Fr, MAX_K,
};

/// This function is used to generate the artifacts for the circuit, i.e. hardcoded keys
/// and parameters. Saves results to `params.bin` and `pk.bin`.
fn gen_params_pk<C: Circuit<Fr> + Default>(circuit_name: &str, full_params: &Params) {
    std::fs::create_dir_all(format!("artifacts/{}", circuit_name))
        .expect("Failed to create directory");
    let (params, k, pk, _) = generate_keys_with_min_k(C::default(), full_params.clone())
        .expect("keys should not fail to generate");
    let params_bytes = marshall_params(&params).expect("Failed to marshall params");
    std::fs::write(
        format!("artifacts/{}/params.bin", circuit_name),
        params_bytes,
    )
    .expect("Failed to write params.bin");
    let key_bytes = marshall_pk(k, &pk);
    std::fs::write(format!("artifacts/{}/pk.bin", circuit_name), key_bytes)
        .expect("Failed to write pk.bin");
}

/// This function is used to generate the artifacts for the DepositCircuit
fn gen_deposit(full_params: &Params) {
    gen_params_pk::<DepositCircuit>("deposit", full_params);
}

/// This function is used to generate the artifacts for the NewAccountCircuit
fn generate_new_account(full_params: &Params) {
    gen_params_pk::<NewAccountCircuit>("new_account", full_params);
}

/// This function is used to generate the artifacts for the WithdrawCircuit
fn generate_withdraw(full_params: &Params) {
    gen_params_pk::<WithdrawCircuit>("withdraw", full_params);
}

fn main() {
    println!("cargo:rerun-if-changed=../shielder-circuits");
    let full_params = read_setup_parameters(
        get_ptau_file_path(MAX_K, Format::PerpetualPowersOfTau),
        Format::PerpetualPowersOfTau,
    )
    .expect("failed to read parameters from the ptau file");

    gen_deposit(&full_params);
    generate_new_account(&full_params);
    generate_withdraw(&full_params);
}
