use shielder_circuits::{
    circuits::{Params, ProvingKey},
    generate_keys_with_min_k, generate_setup_params, Circuit, F, MAX_K,
};
use shielder_setup::parameter_generation;

pub fn proving_keys<C: Circuit<F> + Default>() -> (Params, ProvingKey) {
    let params = generate_setup_params(MAX_K, &mut parameter_generation::rng());
    let (params, _, pk, _) = generate_keys_with_min_k::<C>(params).unwrap();
    (params, pk)
}
