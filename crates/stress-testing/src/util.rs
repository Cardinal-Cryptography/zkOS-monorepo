use powers_of_tau::{get_ptau_file_path, read as read_setup_parameters, Format};
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    generate_keys_with_min_k, Circuit, Fr, MAX_K,
};

pub fn proving_keys<C: Circuit<Fr> + Default>() -> (Params, ProvingKey) {
    let params = read_setup_parameters(
        get_ptau_file_path(MAX_K, Format::PerpetualPowersOfTau),
        Format::PerpetualPowersOfTau,
    )
    .unwrap();
    let (params, _, pk, _) = generate_keys_with_min_k(C::default(), params).unwrap();
    (params, pk)
}
