use alloy_primitives::U256;
use rstest::rstest;
use shielder_rust_sdk::permit2::get_domain_separator;

use crate::{
    permit2,
    shielder::deploy::{deployment, Deployment},
};

#[rstest]
fn domain_separator(mut deployment: Deployment) {
    let expected = deployment
        .evm
        .call(
            deployment.contract_suite.permit2,
            permit2::domain_separator_calldata(),
            None,
            None,
        )
        .expect("Permit2 DOMAIN_SEPARATOR call failed")
        .output;

    assert_eq!(
        get_domain_separator(U256::from(1), deployment.contract_suite.permit2).to_vec(),
        expected
    );
}
