use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolValue};
use evm_utils::{EvmRunner, EvmRunnerError};
use shielder_circuits::GrumpkinPointAffine;
use shielder_contract::ShielderContract::{
    anonymityRevokerPubkeyCall, setAnonymityRevokerPubkeyCall,
};

use crate::call_errors::{decode_call_errors, ShielderCallErrors};

pub fn get_ar_pubkey(shielder_address: Address, evm: &mut EvmRunner) -> GrumpkinPointAffine<U256> {
    let calldata = anonymityRevokerPubkeyCall {}.abi_encode();
    let result = evm
        .call(shielder_address, calldata, None, None)
        .expect("Call failed")
        .output;
    let (x, y) = <(U256, U256)>::abi_decode(&result, true).expect("Decoding failed");
    GrumpkinPointAffine::new(x, y)
}

pub fn set_ar_pubkey(
    new_key: GrumpkinPointAffine<U256>,
    shielder_address: Address,
    evm: &mut EvmRunner,
    caller: Option<Address>,
) -> Result<(), ShielderCallErrors> {
    let calldata = setAnonymityRevokerPubkeyCall {
        anonymityRevokerPubkeyX: new_key.x,
        anonymityRevokerPubkeyY: new_key.y,
    }
    .abi_encode();
    evm.call(shielder_address, calldata, caller, None)
        .map(|_| ())
        .map_err(|e| match e {
            EvmRunnerError::Revert(e) => decode_call_errors(e.output().unwrap()),
            _ => panic!("Expected EvmRunnerError::Revert"),
        })
}

#[cfg(test)]
mod tests {
    use alloy_primitives::U256;
    use rstest::rstest;
    use shielder_circuits::GrumpkinPointAffine;

    use crate::{
        ar_pubkey::{get_ar_pubkey, set_ar_pubkey},
        call_errors::ShielderCallErrors,
        deploy::ANONYMITY_REVOKER_PKEY,
        shielder::deploy::{deployment, Deployment},
    };

    #[rstest]
    fn initial_ar_key_correct(mut deployment: Deployment) {
        let ar_pubkey = get_ar_pubkey(deployment.contract_suite.shielder, &mut deployment.evm);
        assert_eq!(ar_pubkey, ANONYMITY_REVOKER_PKEY);
    }

    #[rstest]
    fn fails_to_set_incorrect_ar_key(mut deployment: Deployment) {
        let new_key = GrumpkinPointAffine::new(U256::from(0), U256::from(1));
        let result = set_ar_pubkey(
            new_key,
            deployment.contract_suite.shielder,
            &mut deployment.evm,
            None,
        );
        assert!(matches!(
            result,
            Err(ShielderCallErrors::InvalidGrumpkinPoint(_))
        ));
    }
}
