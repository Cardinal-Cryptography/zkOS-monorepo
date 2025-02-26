use alloy_primitives::{Address, U256};
use alloy_sol_types::{SolCall, SolValue};
use evm_utils::{EvmRunner, EvmRunnerError};

use crate::{deploy_contract_with_caller, ierc20::IERC20};

pub struct ERC20Token {
    pub contract_address: Address,
    pub faucet_address: Address,
}

impl ERC20Token {
    pub fn deploy(evm: &mut EvmRunner, faucet_address: Address) -> ERC20Token {
        let contract_address =
            deploy_contract_with_caller("testing/ERC20.sol", "Token", Some(faucet_address), evm);

        ERC20Token {
            contract_address,
            faucet_address,
        }
    }

    pub fn faucet(
        &self,
        evm: &mut EvmRunner,
        to: Address,
        value: U256,
    ) -> Result<(), EvmRunnerError> {
        let calldata = IERC20::transferCall { to, value };
        evm.call(
            self.contract_address,
            calldata.abi_encode(),
            Some(self.faucet_address),
            None,
        )?;
        Ok(())
    }

    pub fn get_balance(
        &self,
        evm: &EvmRunner,
        address: Address,
    ) -> Result<U256, alloy_sol_types::Error> {
        let calldata = IERC20::balanceOfCall { account: address };
        let result = evm
            .dry_run(self.contract_address, calldata.abi_encode(), None, None)
            .unwrap();
        <U256>::abi_decode(&result.output, true)
    }

    pub fn approve(
        &self,
        evm: &mut EvmRunner,
        owner: Address,
        spender: Address,
        value: U256,
    ) -> Result<(), EvmRunnerError> {
        let calldata = IERC20::approveCall { spender, value };
        evm.call(
            self.contract_address,
            calldata.abi_encode(),
            Some(owner),
            None,
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use alloy_primitives::{Address, U256};
    use alloy_sol_types::SolCall;
    use evm_utils::EvmRunner;

    use super::ERC20Token;
    use crate::ierc20::IERC20;

    const FAUCET_ADDRESS: &str = "5555555555555555555555555555555555555555";
    const ACTOR_ADDRESS: &str = "6666666666666666666666666666666666666666";
    const RECIPIENT_ADDRESS: &str = "7777777777777777777777777777777777777777";

    #[test]
    fn faucet_works() {
        let faucet_address = Address::from_str(FAUCET_ADDRESS).unwrap();
        let recipient_address = Address::from_str(RECIPIENT_ADDRESS).unwrap();

        let mut evm = EvmRunner::aleph_evm();
        let token = ERC20Token::deploy(&mut evm, faucet_address);

        assert!(token
            .faucet(&mut evm, recipient_address, U256::from(123))
            .is_ok());

        assert_eq!(
            token.get_balance(&evm, recipient_address).unwrap(),
            U256::from(123)
        );
    }

    #[test]
    fn approve_works() {
        let faucet_address = Address::from_str(FAUCET_ADDRESS).unwrap();
        let actor_address = Address::from_str(ACTOR_ADDRESS).unwrap();
        let recipient_address = Address::from_str(RECIPIENT_ADDRESS).unwrap();

        let mut evm = EvmRunner::aleph_evm();
        let token = ERC20Token::deploy(&mut evm, faucet_address);

        assert!(token
            .approve(&mut evm, faucet_address, actor_address, U256::from(123))
            .is_ok());

        let calldata = IERC20::transferFromCall {
            from: faucet_address,
            to: recipient_address,
            value: U256::from(123),
        };
        assert!(evm
            .call(
                token.contract_address,
                calldata.abi_encode(),
                Some(actor_address),
                None
            )
            .is_ok());

        assert_eq!(
            token.get_balance(&evm, recipient_address).unwrap(),
            U256::from(123)
        );
    }
}
