use alloy_primitives::U256;
use alloy_sol_types::{sol, SolCall, SolValue};
use evm_utils::{EvmRunner, SuccessResult};
use halo2_proofs::halo2curves::bn256::Fr;
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_rust_sdk::conversion::field_to_u256;

use crate::deploy_contract;

const POSEIDON2_CONTRACT_NAME: &str = "Poseidon2T8Assembly";
const POSEIDON2_FILE_NAME: &str = "Poseidon2T8Assembly.sol";

sol! {
    function hash(uint[7] memory) public pure returns (uint);
}

fn encode_calldata(values: &[Fr; 7]) -> Vec<u8> {
    let values = values
        .iter()
        .map(field_to_u256::<Fr, 32>)
        .collect::<Vec<_>>();
    let values = values.try_into().unwrap();
    hashCall { _0: values }.abi_encode()
}

#[test]
fn verify_off_chain_and_on_chain_poseidon_preimage() {
    let preimage = [1, 2, 3, 4, 5, 6, 7].map(Fr::from);

    let mut evm = EvmRunner::aleph_evm();
    let poseidon2_address = deploy_contract(POSEIDON2_FILE_NAME, POSEIDON2_CONTRACT_NAME, &mut evm);

    let calldata = encode_calldata(&preimage);
    let response = match evm.call(poseidon2_address, calldata, None, None) {
        Ok(SuccessResult { output, .. }) => output,
        Err(why) => panic!("Failed to call Poseidon2 contract: {why}"),
    };

    let image_on_chain = <U256>::abi_decode(&response, true).unwrap();
    let image_off_chain = hash(&preimage);

    assert_eq!(image_on_chain, field_to_u256(image_off_chain));
}
