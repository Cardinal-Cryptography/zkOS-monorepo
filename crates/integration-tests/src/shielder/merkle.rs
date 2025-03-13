use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolValue};
use evm_utils::EvmRunner;
use shielder_circuits::consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT};
use shielder_contract::{merkle_path::reorganize_merkle_path, ShielderContract::getMerklePathCall};

pub fn get_merkle_path(
    shielder_address: Address,
    note_index: U256,
    evm: &mut EvmRunner,
) -> [[U256; ARITY]; NOTE_TREE_HEIGHT] {
    let calldata = getMerklePathCall { id: note_index }.abi_encode();
    let result = evm
        .call(shielder_address, calldata, None, None)
        .expect("Call failed")
        .output;
    let decoded = <Vec<U256>>::abi_decode(&result, true).expect("Decoding failed");
    reorganize_merkle_path(decoded)
        .expect("Reorganizing failed")
        .1
}

#[cfg(test)]
mod tests {

    use std::assert_matches::assert_matches;

    use alloy_primitives::U256;
    use rstest::rstest;
    use shielder_contract::ShielderContract::getMerklePathCall;

    use crate::{
        shielder::{
            calls::new_account,
            deploy::{deployment, Deployment},
            invoke_shielder_call,
        },
        TestToken,
    };

    #[rstest]
    fn succeeds(mut deployment: Deployment) {
        assert!(new_account::create_account_and_call(
            &mut deployment,
            TestToken::Native,
            U256::from(1),
            U256::from(10)
        )
        .is_ok());

        let calldata = getMerklePathCall { id: U256::ZERO };
        let result = invoke_shielder_call(&mut deployment, &calldata, None);

        assert_matches!(result, Ok(_));
        assert!(result.unwrap().0.is_empty())
    }
}
