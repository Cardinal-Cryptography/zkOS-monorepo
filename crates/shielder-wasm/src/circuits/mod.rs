use alloc::vec::Vec;
use core::marker::PhantomData;

use halo2_proofs::plonk::Error;
use rand::RngCore;
use shielder_circuits::{
    circuits::{Params, ProvingKey, VerifyingKey},
    consts::RANGE_PROOF_CHUNK_SIZE,
    deposit::DepositProverKnowledge,
    generate_keys_with_min_k, generate_proof, generate_setup_params,
    marshall::{unmarshall_params, unmarshall_pk},
    new_account::NewAccountProverKnowledge,
    verify,
    withdraw::WithdrawProverKnowledge,
    ProverKnowledge, PublicInputProvider, F, MAX_K,
};

#[cfg(feature = "merkle")]
pub mod merkle;

pub mod deposit;
pub mod new_account;
pub mod withdraw;

pub trait WasmCircuit {
    fn load_files() -> (Params, ProvingKey, u32);
}

#[derive(Clone, Debug)]
pub struct Circuit<PK: ProverKnowledge<F>> {
    params: Params,
    pk: ProvingKey,
    vk: VerifyingKey,
    k: u32,
    _phantom: PhantomData<PK>,
}

impl WasmCircuit for Circuit<DepositProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>> {
    fn load_files() -> (Params, ProvingKey, u32) {
        let params = unmarshall_params(include_bytes!("../../artifacts/deposit/params.bin"))
            .expect("Failed to unmarshall params");

        let (k, pk) = unmarshall_pk::<
            <DepositProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE> as ProverKnowledge<F>>::Circuit,
        >(include_bytes!("../../artifacts/deposit/pk.bin"))
        .expect("Failed to unmarshall pk");

        (params, pk, k)
    }
}

impl WasmCircuit for Circuit<NewAccountProverKnowledge<F>> {
    fn load_files() -> (Params, ProvingKey, u32) {
        let params = unmarshall_params(include_bytes!("../../artifacts/new_account/params.bin"))
            .expect("Failed to unmarshall params");
        let (k, pk) =
            unmarshall_pk::<<NewAccountProverKnowledge<F> as ProverKnowledge<F>>::Circuit>(
                include_bytes!("../../artifacts/new_account/pk.bin"),
            )
            .expect("Failed to unmarshall pk");

        (params, pk, k)
    }
}

impl WasmCircuit for Circuit<WithdrawProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>> {
    fn load_files() -> (Params, ProvingKey, u32) {
        let params = unmarshall_params(include_bytes!("../../artifacts/withdraw/params.bin"))
            .expect("Failed to unmarshall params");
        let (k, pk) = unmarshall_pk::<
            <WithdrawProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE> as ProverKnowledge<F>>::Circuit,
        >(include_bytes!("../../artifacts/withdraw/pk.bin"))
        .expect("Failed to unmarshall pk");

        (params, pk, k)
    }
}

impl<PK: ProverKnowledge<F>> Circuit<PK>
where
    Circuit<PK>: WasmCircuit,
{
    pub fn k(&self) -> u32 {
        self.k
    }

    pub fn vk(&self) -> VerifyingKey {
        self.vk.clone()
    }

    pub fn pk(&self) -> ProvingKey {
        self.pk.clone()
    }

    pub fn params(&self) -> Params {
        self.params.clone()
    }

    pub fn new(rng: &mut impl RngCore) -> Self {
        let (params, k, pk, vk) =
            generate_keys_with_min_k::<PK::Circuit>(generate_setup_params(MAX_K, rng))
                .expect("keys should not fail to generate");

        Circuit {
            params,
            pk,
            vk,
            k,
            _phantom: PhantomData,
        }
    }

    /// Create a new DepositCircuit with hardcoded keys, which is faster than generating new keys.
    pub fn new_pronto() -> Self {
        let (params, pk, k) = Self::load_files();

        let vk = pk.get_vk().clone();

        Circuit {
            params,
            pk,
            vk,
            k,
            _phantom: PhantomData,
        }
    }

    pub fn prove(&mut self, values: &PK, rng: &mut impl RngCore) -> Vec<u8> {
        generate_proof(
            &self.params,
            &self.pk,
            values.create_circuit(),
            &values.serialize_public_input(),
            rng,
        )
    }

    pub fn verify<PIP: PublicInputProvider<PK::PublicInput, F>>(
        &self,
        pub_input_provider: &PIP,
        proof: Vec<u8>,
    ) -> Result<(), Error> {
        verify(
            &self.params,
            &self.vk,
            &proof,
            &pub_input_provider.serialize_public_input(),
        )
    }
}

pub type DepositCircuit = Circuit<DepositProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>>;
pub type NewAccountCircuit = Circuit<NewAccountProverKnowledge<F>>;
pub type WithdrawCircuit = Circuit<WithdrawProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>>;

#[cfg(test)]
mod tests {
    use shielder_circuits::{
        consts::RANGE_PROOF_CHUNK_SIZE, deposit::DepositProverKnowledge,
        new_account::NewAccountProverKnowledge, withdraw::WithdrawProverKnowledge, ProverKnowledge,
        PublicInputProvider, F,
    };

    use super::{DepositCircuit, NewAccountCircuit, WithdrawCircuit};

    #[test]
    fn deposit_pronto() {
        let mut rng = rand::thread_rng();
        let mut circuit = DepositCircuit::new_pronto();
        let values =
            DepositProverKnowledge::<F, RANGE_PROOF_CHUNK_SIZE>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn new_account_pronto() {
        let mut rng = rand::thread_rng();
        let mut circuit = NewAccountCircuit::new_pronto();
        let values = NewAccountProverKnowledge::<F>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn withdraw_pronto() {
        let mut rng = rand::thread_rng();
        let mut circuit = WithdrawCircuit::new_pronto();
        let values =
            WithdrawProverKnowledge::<F, RANGE_PROOF_CHUNK_SIZE>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }
}
