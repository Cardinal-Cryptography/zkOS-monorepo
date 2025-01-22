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
use shielder_circuits_v0_1_0::{
    deposit::DepositProverKnowledge as DepositProverKnowledgeV0_1_0,
    marshall::unmarshall_pk as unmarshall_pk_v0_1_0, verify as verify_v0_1_0,
    ProverKnowledge as ProverKnowledgeV0_1_0, PublicInputProvider as PublicInputProviderV0_1_0,
};

pub mod deposit;
pub mod deposit_v0_1_0;
pub mod error;
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
    _phantom: PhantomData<PK>,
}

#[derive(Clone, Debug)]
pub struct CircuitV0_1_0<PK: ProverKnowledgeV0_1_0> {
    params: Params,
    pk: ProvingKey,
    vk: VerifyingKey,
    _phantom: PhantomData<PK>,
}

macro_rules! impl_load_files {
    ($circuit_type:ty, $circuit_name:literal) => {
        impl WasmCircuit for Circuit<$circuit_type> {
            fn load_files() -> (Params, ProvingKey, u32) {
                let params = unmarshall_params(include_bytes!(concat!(
                    "../../artifacts/",
                    $circuit_name,
                    "/params.bin"
                )))
                .expect("Failed to unmarshall params");

                let (k, pk) = unmarshall_pk::<<$circuit_type as ProverKnowledge<F>>::Circuit>(
                    include_bytes!(concat!("../../artifacts/", $circuit_name, "/pk.bin")),
                )
                .expect("Failed to unmarshall pk");

                (params, pk, k)
            }
        }
    };
}

impl_load_files!(DepositProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>, "deposit");
impl_load_files!(NewAccountProverKnowledge<F>, "new_account");
impl_load_files!(WithdrawProverKnowledge<F, RANGE_PROOF_CHUNK_SIZE>, "withdraw");

impl WasmCircuit for CircuitV0_1_0<DepositProverKnowledgeV0_1_0<F>> {
    fn load_files() -> (Params, ProvingKey, u32) {
        let params = unmarshall_params(include_bytes!("../../artifacts/deposit_v0_1_0/params.bin"))
            .expect("Failed to unmarshall params");

        let (k, pk) = unmarshall_pk_v0_1_0::<
            <DepositProverKnowledgeV0_1_0<F> as ProverKnowledgeV0_1_0>::Circuit,
        >(include_bytes!("../../artifacts/deposit_v0_1_0/pk.bin"))
        .expect("Failed to unmarshall pk");

        (params, pk, k)
    }
}

impl<PK: ProverKnowledge<F>> Circuit<PK>
where
    Circuit<PK>: WasmCircuit,
{
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
        let (params, _k, pk, vk) =
            generate_keys_with_min_k::<PK::Circuit>(generate_setup_params(MAX_K, rng))
                .expect("keys should not fail to generate");

        Circuit {
            params,
            pk,
            vk,
            _phantom: PhantomData,
        }
    }

    /// Create a new DepositCircuit with hardcoded keys, which is faster than generating new keys.
    pub fn new_pronto() -> Self {
        let (params, pk, _k) = Self::load_files();

        let vk = pk.get_vk().clone();

        Circuit {
            params,
            pk,
            vk,
            _phantom: PhantomData,
        }
    }

    pub fn prove(&self, values: &PK, rng: &mut impl RngCore) -> Vec<u8> {
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

impl<PK: ProverKnowledgeV0_1_0> CircuitV0_1_0<PK>
where
    CircuitV0_1_0<PK>: WasmCircuit,
{
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
        let (params, _k, pk, vk) =
            generate_keys_with_min_k::<PK::Circuit>(generate_setup_params(MAX_K, rng))
                .expect("keys should not fail to generate");

        CircuitV0_1_0 {
            params,
            pk,
            vk,
            _phantom: PhantomData,
        }
    }

    /// Create a new DepositCircuit with hardcoded keys, which is faster than generating new keys.
    pub fn new_pronto() -> Self {
        let (params, pk, _k) = Self::load_files();

        let vk = pk.get_vk().clone();

        CircuitV0_1_0 {
            params,
            pk,
            vk,
            _phantom: PhantomData,
        }
    }

    pub fn prove(&self, values: &PK, rng: &mut impl RngCore) -> Vec<u8> {
        generate_proof(
            &self.params,
            &self.pk,
            values.create_circuit(),
            &values.serialize_public_input(),
            rng,
        )
    }

    pub fn verify<PIP: PublicInputProviderV0_1_0<PK::PublicInput>>(
        &self,
        pub_input_provider: &PIP,
        proof: Vec<u8>,
    ) -> Result<(), Error> {
        verify_v0_1_0(
            &self.params,
            &self.vk,
            &proof,
            &pub_input_provider.serialize_public_input(),
        )
    }
}

pub type DepositCircuitV0_1_0 = CircuitV0_1_0<DepositProverKnowledgeV0_1_0<F>>;

#[cfg(test)]
mod tests {
    use shielder_circuits::{
        consts::RANGE_PROOF_CHUNK_SIZE, deposit::DepositProverKnowledge,
        new_account::NewAccountProverKnowledge, withdraw::WithdrawProverKnowledge, ProverKnowledge,
        F,
    };
    use shielder_circuits_v0_1_0::{
        deposit::DepositProverKnowledge as DepositProverKnowledgeV0_1_0,
        ProverKnowledge as ProverKnowledgeV0_1_0,
    };

    use super::{DepositCircuit, DepositCircuitV0_1_0, NewAccountCircuit, WithdrawCircuit};

    #[test]
    fn deposit_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = DepositCircuit::new_pronto();
        let values =
            DepositProverKnowledge::<F, RANGE_PROOF_CHUNK_SIZE>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn new_account_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = NewAccountCircuit::new_pronto();
        let values = NewAccountProverKnowledge::<F>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn withdraw_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = WithdrawCircuit::new_pronto();
        let values =
            WithdrawProverKnowledge::<F, RANGE_PROOF_CHUNK_SIZE>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn deposit_v0_1_0_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = DepositCircuitV0_1_0::new_pronto();
        let values = DepositProverKnowledgeV0_1_0::<F>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }
}
