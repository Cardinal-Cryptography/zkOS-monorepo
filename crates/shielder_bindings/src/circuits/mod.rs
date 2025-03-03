use alloc::vec::Vec;
use core::marker::PhantomData;

use halo2_proofs::plonk::Error;
use rand::RngCore;
use shielder_circuits::{
    circuits::{Params, ProvingKey, VerifyingKey},
    deposit::DepositProverKnowledge,
    generate_keys_with_min_k, generate_proof, generate_setup_params,
    marshall::{unmarshall_params, unmarshall_pk},
    new_account::NewAccountProverKnowledge,
    verify,
    withdraw::WithdrawProverKnowledge,
    Fr, ProverKnowledge, PublicInputProvider, MAX_K,
};

pub mod deposit;
pub mod error;
pub mod new_account;
pub mod withdraw;

pub trait WasmCircuit {
    fn decode_from_bytes(params_buf: &[u8], pk_buf: &[u8]) -> (Params, ProvingKey, u32);
}

#[derive(Clone, Debug)]
pub struct Circuit<PK: ProverKnowledge> {
    params: Params,
    pk: ProvingKey,
    vk: VerifyingKey,
    k: u32,
    _phantom: PhantomData<PK>,
}

macro_rules! impl_decode_bytes {
    ($circuit_type:ty, $circuit_name:literal) => {
        impl WasmCircuit for Circuit<$circuit_type> {
            fn decode_from_bytes(params_buf: &[u8], pk_buf: &[u8]) -> (Params, ProvingKey, u32) {
                let params = unmarshall_params(params_buf).expect("Failed to unmarshall params");

                let (k, pk) = unmarshall_pk::<<$circuit_type as ProverKnowledge>::Circuit>(pk_buf)
                    .expect("Failed to unmarshall pk");

                (params, pk, k)
            }
        }
    };
}

impl_decode_bytes!(DepositProverKnowledge<Fr>, "deposit");
impl_decode_bytes!(NewAccountProverKnowledge<Fr>, "new_account");
impl_decode_bytes!(WithdrawProverKnowledge<Fr>, "withdraw");

impl<PK: ProverKnowledge> Circuit<PK>
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
            generate_keys_with_min_k(PK::Circuit::default(), generate_setup_params(MAX_K, rng))
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
    pub fn new_pronto(params_buf: &[u8], pk_buf: &[u8]) -> Self {
        let (params, pk, k) = Self::decode_from_bytes(params_buf, pk_buf);

        let vk = pk.get_vk().clone();

        Circuit {
            params,
            pk,
            vk,
            k,
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

    pub fn verify<PIP: PublicInputProvider<PK::PublicInput>>(
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

pub type DepositCircuit = Circuit<DepositProverKnowledge<Fr>>;
pub type NewAccountCircuit = Circuit<NewAccountProverKnowledge<Fr>>;
pub type WithdrawCircuit = Circuit<WithdrawProverKnowledge<Fr>>;

#[cfg(test)]
mod tests {
    use shielder_circuits::{
        deposit::DepositProverKnowledge, new_account::NewAccountProverKnowledge,
        withdraw::WithdrawProverKnowledge, Fr, ProverKnowledge,
    };

    use super::{DepositCircuit, NewAccountCircuit, WithdrawCircuit};

    #[test]
    fn deposit_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = DepositCircuit::new_pronto(
            include_bytes!("../../artifacts/deposit/params.bin"),
            include_bytes!("../../artifacts/deposit/pk.bin"),
        );
        let values = DepositProverKnowledge::<Fr>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn new_account_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = NewAccountCircuit::new_pronto(
            include_bytes!("../../artifacts/new_account/params.bin"),
            include_bytes!("../../artifacts/new_account/pk.bin"),
        );
        let values = NewAccountProverKnowledge::<Fr>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }

    #[test]
    fn withdraw_pronto() {
        let mut rng = rand::thread_rng();
        let circuit = WithdrawCircuit::new_pronto(
            include_bytes!("../../artifacts/withdraw/params.bin"),
            include_bytes!("../../artifacts/withdraw/pk.bin"),
        );
        let values = WithdrawProverKnowledge::<Fr>::random_correct_example(&mut rng);
        let proof = circuit.prove(&values, &mut rng);
        circuit.verify(&values, proof).unwrap();
    }
}
