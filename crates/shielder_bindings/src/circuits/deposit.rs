use alloc::vec::Vec;

use shielder_circuits::deposit::{DepositInstance, DepositProverKnowledge};
use wasm_bindgen::{prelude::wasm_bindgen, JsError};

use crate::{vec_to_f, vec_to_path};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct DepositCircuit(super::DepositCircuit);

#[wasm_bindgen]
impl DepositCircuit {
    #[wasm_bindgen(constructor)]
    pub fn new_pronto() -> Self {
        log("Creating DepositCircuit (pronto)");
        DepositCircuit(super::DepositCircuit::new_pronto())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn prove(
        &mut self,
        id: Vec<u8>,
        nonce: Vec<u8>,
        nullifier_old: Vec<u8>,
        trapdoor_old: Vec<u8>,
        account_balance_old: Vec<u8>,
        path: Vec<u8>,
        value: Vec<u8>,
        nullifier_new: Vec<u8>,
        trapdoor_new: Vec<u8>,
    ) -> Vec<u8> {
        log("Proving DepositCircuit");
        self.0.prove(
            &DepositProverKnowledge {
                id: vec_to_f(id),
                nonce: vec_to_f(nonce),
                nullifier_old: vec_to_f(nullifier_old),
                trapdoor_old: vec_to_f(trapdoor_old),
                account_old_balance: vec_to_f(account_balance_old),
                path: vec_to_path(path),
                deposit_value: vec_to_f(value),
                nullifier_new: vec_to_f(nullifier_new),
                trapdoor_new: vec_to_f(trapdoor_new),
            },
            &mut rand::thread_rng(),
        )
    }

    #[wasm_bindgen]
    pub fn verify(
        &mut self,
        id_hiding: Vec<u8>,
        merkle_root: Vec<u8>,
        h_nullifier_old: Vec<u8>,
        h_note_new: Vec<u8>,
        value: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), JsError> {
        log("Verifying DepositCircuit");

        let public_input = |input: DepositInstance| {
            let value = match input {
                DepositInstance::IdHiding => &id_hiding,
                DepositInstance::MerkleRoot => &merkle_root,
                DepositInstance::HashedOldNullifier => &h_nullifier_old,
                DepositInstance::HashedNewNote => &h_note_new,
                DepositInstance::DepositValue => &value,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(JsError::from)
    }
}
