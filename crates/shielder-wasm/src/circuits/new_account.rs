use alloc::vec::Vec;

use shielder_circuits::new_account::{NewAccountInstance, NewAccountProverKnowledge};
use wasm_bindgen::{prelude::wasm_bindgen, JsError};

use crate::vec_to_f;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct NewAccountCircuit(super::NewAccountCircuit);

#[wasm_bindgen]
impl NewAccountCircuit {
    #[wasm_bindgen(constructor)]
    pub fn new_pronto() -> Self {
        log("Creating NewAccountCircuit (pronto)");
        NewAccountCircuit(super::NewAccountCircuit::new_pronto())
    }

    pub fn prove(
        &mut self,
        id: Vec<u8>,
        nullifier: Vec<u8>,
        trapdoor: Vec<u8>,
        initial_deposit: Vec<u8>,
    ) -> Vec<u8> {
        log("Proving NewAccountCircuit");
        self.0.prove(
            &NewAccountProverKnowledge {
                id: vec_to_f(id),
                nullifier: vec_to_f(nullifier),
                trapdoor: vec_to_f(trapdoor),
                initial_deposit: vec_to_f(initial_deposit),
            },
            &mut rand::thread_rng(),
        )
    }

    #[wasm_bindgen]
    pub fn verify(
        &mut self,
        h_note: Vec<u8>,
        h_id: Vec<u8>,
        initial_deposit: Vec<u8>,
        proof: Vec<u8>,
    ) -> Result<(), JsError> {
        log("Verifying NewAccountCircuit");

        let public_input = |input: NewAccountInstance| {
            let value = match input {
                NewAccountInstance::HashedId => &h_id,
                NewAccountInstance::HashedNote => &h_note,
                NewAccountInstance::InitialDeposit => &initial_deposit,
            };
            vec_to_f(value.clone())
        };

        self.0.verify(&public_input, proof).map_err(JsError::from)
    }
}
