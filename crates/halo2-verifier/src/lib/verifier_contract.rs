#![allow(missing_docs)]
use alloy_primitives::Address;
use alloy_sol_types::{private::Bytes, sol, SolCall};
use halo2_proofs::halo2curves::bn256::Fr;
use shielder_rust_sdk::conversion::field_to_u256;

sol! {
    function verifyProof(
        address vk,
        bytes calldata proof,
        uint256[] calldata instances
    ) public returns (bool);
}

/// Encode proof into calldata to invoke `Halo2Verifier.verifyProof`.
pub fn encode_calldata(vk: Address, proof: &[u8], instances: &[Fr]) -> Vec<u8> {
    verifyProofCall {
        vk,
        proof: Bytes::from(proof.to_vec()),
        instances: instances.iter().map(field_to_u256::<Fr, 32>).collect(),
    }
    .abi_encode()
}
