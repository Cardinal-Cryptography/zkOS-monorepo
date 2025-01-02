use alloy_sol_types::sol;

sol! {
    function addressToUInt256(address addr) public pure returns (uint256);
}

#[cfg(test)]
mod tests {

    use alloy_primitives::{address, U256};
    use alloy_sol_types::{SolCall, SolValue};
    use halo2_proofs::halo2curves::bn256::Fr;
    use rstest::rstest;
    use shielder_rust_sdk::conversion::{address_to_field, field_to_u256};

    use crate::{
        address_conversion::addressToUInt256Call,
        shielder::deploy::{deployment, Deployment},
    };

    #[rstest]
    fn verify_off_chain_and_on_chain_address_to_u256_conversion(mut deployment: Deployment) {
        let some_address = address!("f39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

        let on_chain_result = deployment
            .evm
            .call(
                deployment.contract_suite.shielder,
                addressToUInt256Call { addr: some_address }.abi_encode(),
                None,
                None,
            )
            .expect("Failed to convert address to field on-chain");
        let on_chain = <U256>::abi_decode(&on_chain_result.output, true)
            .expect("Failed to decode on-chain result");

        let off_chain = field_to_u256(address_to_field::<Fr>(some_address));

        assert_eq!(on_chain, off_chain);
    }
}
