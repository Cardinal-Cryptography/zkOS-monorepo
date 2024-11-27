use alloc::{format, string::String, vec, vec::Vec};

use rand_core::{RngCore, SeedableRng};
use sha2::Digest;
use shielder_circuits::{
    circuits::{merkle::MerkleCircuit as MerkleCircuitOrig, Params, ProvingKey, VerifyingKey},
    consts::merkle_constants::NOTE_TREE_HEIGHT,
    generate_keys_with_min_k, generate_proof, generate_setup_params,
    marshall::{unmarshall_params, unmarshall_path, unmarshall_pk},
    merkle::MerkleProverKnowledge,
    verify, CircuitCost, Field, ProverKnowledge, PublicInputProvider, F, G1, MAX_K, SERDE_FORMAT,
};

pub mod wasm;

#[derive(Clone, Debug)]
pub struct MerkleCircuit {
    params: Params,
    pk: ProvingKey,
    vk: VerifyingKey,
    k: u32,
    proof: Vec<u8>,
    values: MerkleProverKnowledge<NOTE_TREE_HEIGHT, F>,
    tree_height: usize,
}

impl MerkleCircuit {
    pub fn new(rng: &mut impl RngCore) -> Self {
        let values = MerkleProverKnowledge::<NOTE_TREE_HEIGHT, _>::random_correct_example(rng);

        let (params, k, pk, vk) =
            generate_keys_with_min_k::<MerkleCircuitOrig<NOTE_TREE_HEIGHT, _>>(
                generate_setup_params(MAX_K, rng),
            )
            .expect("keys should not fail to generate");

        MerkleCircuit {
            params,
            pk,
            vk,
            k,
            proof: vec![],
            values,
            tree_height: NOTE_TREE_HEIGHT,
        }
    }

    /// Create a new MerkleCircuit with hardcoded keys and path, which is faster than generating new keys.
    /// If `seed` is provided, it will be used for the penultimate layer of the Merkle path
    /// (this is for making the proof dependent on the seed).
    ///
    /// Complexity:
    /// - decoding parameters and keys from raw bytes
    /// - decoding path from raw bytes
    /// - optionally, two Poseidon hashes (iff `seed` is provided)
    pub fn new_pronto(seed: Option<String>) -> Self {
        let params = unmarshall_params(include_bytes!("../../../artifacts/merkle/params.bin"))
            .expect("Failed to unmarshall params");
        let (k, pk) = unmarshall_pk::<MerkleCircuitOrig<NOTE_TREE_HEIGHT, F>>(include_bytes!(
            "../../../artifacts/merkle/pk.bin"
        ))
        .expect("Failed to unmarshall pk");

        let vk = pk.get_vk().clone();
        let (leaf, mut path) =
            unmarshall_path::<F>(include_bytes!("../../../artifacts/merkle/path.bin"));

        if let Some(seed) = seed {
            let bytes = sha2::Sha256::digest(seed.as_bytes());
            let seeded_node = F::random(rand_chacha::ChaCha12Rng::from_seed(bytes.into()));

            path[NOTE_TREE_HEIGHT - 1][1] = seeded_node;
        }

        let values = MerkleProverKnowledge { leaf, path };

        MerkleCircuit {
            params,
            pk,
            vk,
            k,
            proof: vec![],
            values,
            tree_height: NOTE_TREE_HEIGHT,
        }
    }

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

    pub fn proof(&self) -> Option<Vec<u8>> {
        if self.proof.is_empty() {
            return None;
        }
        Some(self.proof.clone())
    }

    pub fn tree_height(&self) -> u32 {
        self.tree_height as u32
    }

    pub fn circuit_cost(
        &self,
        rng: &mut impl RngCore,
    ) -> CircuitCost<G1, MerkleCircuitOrig<NOTE_TREE_HEIGHT, F>> {
        let merkle_prover_knowledge =
            MerkleProverKnowledge::<NOTE_TREE_HEIGHT, _>::random_correct_example(rng);
        let circuit = merkle_prover_knowledge.create_circuit();
        CircuitCost::<G1, _>::measure(self.k, &circuit)
    }

    pub fn verifying_key_size_bytes(&self) -> usize {
        // Using `to_bytes` because `VerifyingKey::bytes_length` is private.
        self.vk.to_bytes(SERDE_FORMAT).len()
    }

    //TODO: Change to return a Result(String, Error). This is mostly fixing wasm-frontend interaction.
    pub fn prove(&mut self, rng: &mut impl RngCore) -> String {
        let circuit = self.values.create_circuit();
        self.proof = generate_proof(
            &self.params,
            &self.pk,
            circuit,
            &self.values.serialize_public_input(),
            rng,
        );
        format!("{:?}", self.proof)
    }

    //TODO: Change to return a Result(String, Error). This is mostly fixing wasm-frontend interaction.
    pub fn verify(&self) -> String {
        if self.proof.is_empty() {
            panic!("Proof was not initialized.");
        }

        format!(
            "{:?}",
            verify(
                &self.params,
                &self.vk,
                &self.proof,
                &self.values.serialize_public_input(),
            )
        )
    }
}

#[cfg(test)]
mod tests {
    use alloc::string::String;

    use super::MerkleCircuit;

    #[test]
    fn pronto() {
        let mut circuit = MerkleCircuit::new_pronto(None);
        circuit.prove(&mut rand::thread_rng());
        circuit.verify();
    }

    #[test]
    fn pronto_with_seed() {
        let mut circuit = MerkleCircuit::new_pronto(Some(String::from("0xethereum address")));
        circuit.prove(&mut rand::thread_rng());
        circuit.verify();
    }
}
