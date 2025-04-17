use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolValue};
use evm_utils::EvmRunner;
use shielder_circuits::GrumpkinPointAffine;
use shielder_contract::ShielderContract::anonymityRevokerPubkeyCall;

pub fn get_ar_pubkey(shielder_address: Address, evm: &mut EvmRunner) -> GrumpkinPointAffine<U256> {
    let calldata = anonymityRevokerPubkeyCall {}.abi_encode();
    let result = evm
        .call(shielder_address, calldata, None, None)
        .expect("Call failed")
        .output;
    let (x, y) = <(U256, U256)>::abi_decode(&result, true).expect("Decoding failed");
    GrumpkinPointAffine::new(x, y)
}

#[cfg(test)]
mod tests {
    use rstest::rstest;
    use crate::{
        ar_pubkey::get_ar_pubkey,
        deploy::ANONYMITY_REVOKER_PKEY,
        shielder::deploy::{deployment, Deployment},
    };

    #[rstest]
    fn initial_ar_key_correct(mut deployment: Deployment) {
        let ar_pubkey = get_ar_pubkey(deployment.contract_suite.shielder, &mut deployment.evm);
        assert_eq!(ar_pubkey, ANONYMITY_REVOKER_PKEY);
    }
}
