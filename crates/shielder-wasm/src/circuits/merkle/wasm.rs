use alloc::{format, string::String, vec::Vec};

use console_error_panic_hook;
use shielder_circuits::consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct Config {
    #[wasm_bindgen]
    pub k: u32,

    #[wasm_bindgen(js_name = "treeArity")]
    pub tree_arity: u32,

    #[wasm_bindgen(js_name = "treeHeight")]
    pub tree_height: u32,

    #[wasm_bindgen(js_name = "log2Leaves")]
    pub log2_leaves: u32,
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct CircuitCost {
    proof_size: String,
    proof_size_bytes: usize,

    marginal_proof_size: String,
    marginal_proof_size_bytes: usize,

    verifying_key_size_bytes: usize,

    circuit_cost_str: String,
}

#[wasm_bindgen]
impl CircuitCost {
    #[wasm_bindgen(getter, js_name = "proofSize")]
    pub fn proof_size(&self) -> String {
        self.proof_size.clone()
    }

    #[wasm_bindgen(getter, js_name = "proofSizeBytes")]
    pub fn proof_size_bytes(&self) -> usize {
        self.proof_size_bytes
    }

    #[wasm_bindgen(getter, js_name = "marginalProofSize")]
    pub fn marginal_proof_size(&self) -> String {
        self.marginal_proof_size.clone()
    }

    #[wasm_bindgen(getter, js_name = "marginalProofSizeBytes")]
    pub fn marginal_proof_size_bytes(&self) -> usize {
        self.marginal_proof_size_bytes
    }

    #[wasm_bindgen(getter, js_name = "verifyingKeySizeBytes")]
    pub fn verifying_key_size_bytes(&self) -> usize {
        self.verifying_key_size_bytes
    }

    #[wasm_bindgen(getter, js_name = "circuitCostStr")]
    pub fn circuit_cost_str(&self) -> String {
        self.circuit_cost_str.clone()
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct MerkleCircuit(super::MerkleCircuit);

#[wasm_bindgen]
impl MerkleCircuit {
    #[wasm_bindgen(constructor)]
    pub fn new_pronto(seed: Option<String>) -> Self {
        log("Creating MerkleCircuit (pronto)");
        MerkleCircuit(super::MerkleCircuit::new_pronto(seed))
    }

    #[wasm_bindgen]
    pub fn prove(&mut self) -> String {
        log("Proving MerkleCircuit");
        self.0.prove(&mut rand::thread_rng())
    }

    #[wasm_bindgen(getter)]
    pub fn config(&self) -> Config {
        // Using a larger type to avoid overflow
        let arity = ARITY as f64;
        let tree_height = NOTE_TREE_HEIGHT as f64;
        let log2_leaves = f64::powf(arity, tree_height).log2() as u32;
        Config {
            k: self.0.k(),
            tree_height: self.0.tree_height(),
            tree_arity: ARITY as u32,
            log2_leaves,
        }
    }

    #[wasm_bindgen(getter, js_name = "circuitCost")]
    pub fn circuit_cost(&self) -> CircuitCost {
        let cost = self.0.circuit_cost(&mut rand::thread_rng());
        let proof_size_struct = cost.proof_size(1);
        let marginal_proof_size_struct = cost.marginal_proof_size();

        // TODO: Use serde_json to serialize the struct instead; requires adding Serialize trait to CircuitCost
        let proof_size = format!("{:?}", proof_size_struct);
        let marginal_proof_size = format!("{:?}", marginal_proof_size_struct);

        let proof_size_bytes = usize::from(proof_size_struct);
        let marginal_proof_size_bytes = usize::from(marginal_proof_size_struct);

        let verifying_key_size_bytes = self.0.verifying_key_size_bytes();

        CircuitCost {
            proof_size,
            proof_size_bytes,
            marginal_proof_size,
            marginal_proof_size_bytes,
            verifying_key_size_bytes,
            circuit_cost_str: format!("{:?}", cost),
        }
    }

    #[wasm_bindgen]
    pub fn verify(&mut self) -> String {
        log("Verifying MerkleCircuit");
        self.0.verify()
    }

    #[wasm_bindgen]
    pub fn proof(&mut self) -> Vec<u8> {
        log("Verifying MerkleCircuit");
        self.0.proof.clone()
    }
}
