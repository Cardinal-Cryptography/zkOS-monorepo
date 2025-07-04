//! this module is a copy-paste of crates/shielder_bindings/src/circuits
//! some of the original contents were removed as target of this module is purely std

use std::vec::Vec;
use core::marker::PhantomData;

use rand::RngCore;
use shielder_circuits::{
    circuits::{Params, ProvingKey, VerifyingKey},
    deposit::DepositProverKnowledge,
    generate_proof,
    marshall::{unmarshall_params, unmarshall_pk},
    new_account::NewAccountProverKnowledge,
    withdraw::WithdrawProverKnowledge,
    Fr, ProverKnowledge,
};
use shielder_circuits::consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT};
use type_conversions::bytes_to_field;

pub mod new_account;
pub mod deposit;
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
}

pub type DepositCircuit = Circuit<DepositProverKnowledge<Fr>>;
pub type NewAccountCircuit = Circuit<NewAccountProverKnowledge<Fr>>;
pub type WithdrawCircuit = Circuit<WithdrawProverKnowledge<Fr>>;

pub fn vec_to_f(v: Vec<u8>) -> Fr {
    bytes_to_field(v).expect("failed to convert to F")
}

pub fn vec_to_path(v: Vec<u8>) -> [[Fr; ARITY]; NOTE_TREE_HEIGHT] {
    assert_eq!(
        NOTE_TREE_HEIGHT * ARITY * Fr::size(),
        v.len(),
        "Vector length must be divisible by TREE_HEIGHT * ARITY * F::size()"
    );

    let mut result = [[Fr::default(); ARITY]; NOTE_TREE_HEIGHT];
    let mut iter = v.chunks_exact(Fr::size());

    for row in result.iter_mut().take(NOTE_TREE_HEIGHT) {
        for elem in row.iter_mut().take(ARITY) {
            if let Some(chunk) = iter.next() {
                *elem = Fr::from_bytes(
                    chunk
                        .try_into()
                        .unwrap_or_else(|_| panic!("should be {} bytes long", Fr::size())),
                )
                    .expect("failed to convert to F");
            }
        }
    }

    result
}
