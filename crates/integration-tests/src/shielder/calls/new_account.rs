use std::str::FromStr;

use alloy_primitives::{Address, TxHash, U256};
use shielder_account::{
    call_data::{NewAccountGenericCall, NewAccountGenericCallType},
    ShielderAccount,
};
use shielder_contract::ShielderContract::{
    newAccountERC20Call, newAccountNativeCall, ShielderContractErrors,
};

use crate::{
    deploy::{ACTOR_ADDRESS, ANONYMITY_REVOKER_PKEY},
    shielder::{invoke_shielder_call, CallResult, Deployment},
    TestToken,
};

pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    token: TestToken,
    amount: U256,
) -> NewAccountGenericCall {
    let (params, pk) = deployment.new_account_proving_params.clone();
    shielder_account.prepare_call::<NewAccountGenericCallType>(
        &params,
        &pk,
        amount,
        &(token.address(deployment), ANONYMITY_REVOKER_PKEY),
    )
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    token: TestToken,
    calldata: &NewAccountGenericCall,
) -> CallResult {
    let call_result = match token {
        TestToken::Native => {
            let amount = Some(calldata.amount);
            let calldata: newAccountNativeCall = calldata.clone().into();
            invoke_shielder_call(deployment, &calldata, amount)
        }
        TestToken::ERC20 => {
            deployment
                .test_erc20
                .approve(
                    &mut deployment.evm,
                    Address::from_str(ACTOR_ADDRESS).unwrap(),
                    deployment.contract_suite.shielder,
                    calldata.amount,
                )
                .unwrap();

            let calldata: newAccountERC20Call = calldata.clone().into();
            invoke_shielder_call(deployment, &calldata, None)
        }
    };

    match call_result {
        Ok((events, success_result)) => {
            assert!(events.len() == 1);
            let event = events[0].clone();
            shielder_account.register_action((TxHash::default(), event.clone()));
            Ok((events, success_result))
        }
        Err(err) => Err(err),
    }
}

pub fn create_account_and_call(
    deployment: &mut Deployment,
    token: TestToken,
    id: U256,
    initial_amount: U256,
) -> Result<ShielderAccount, ShielderContractErrors> {
    let mut shielder_account = ShielderAccount::new(id);

    let calldata = prepare_call(deployment, &mut shielder_account, token, initial_amount);
    let result = invoke_call(deployment, &mut shielder_account, token, &calldata);

    match result {
        Ok(_) => Ok(shielder_account),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {

    use std::{assert_matches::assert_matches, mem, str::FromStr};

    use alloy_primitives::{Address, FixedBytes, U256};
    use evm_utils::SuccessResult;
    use halo2_proofs::halo2curves::ff::PrimeField;
    use rstest::rstest;
    use shielder_account::ShielderAccount;
    use shielder_circuits::Fr;
    use shielder_contract::ShielderContract::{
        NewAccount, ShielderContractErrors, ShielderContractEvents, WrongContractVersion,
    };

    use crate::{
        calls::new_account::{create_account_and_call, invoke_call, prepare_call, TestToken},
        deploy::{
            deployment, ACTOR_ADDRESS, ACTOR_INITIAL_ERC20_BALANCE, ACTOR_INITIAL_NATIVE_BALANCE,
        },
        shielder::Deployment,
    };

    // TODO: move to `mod.rs` once ERC20 is added to deposit and withdraw tests.
    fn get_balance(deployment: &Deployment, token: TestToken, address: &str) -> U256 {
        let address = Address::from_str(address).unwrap();

        match token {
            TestToken::Native => deployment.evm.get_balance(address).unwrap(),
            TestToken::ERC20 => deployment
                .test_erc20
                .get_balance(&deployment.evm, address)
                .unwrap(),
        }
    }

    // TODO: move to `mod.rs` once ERC20 is added to deposit and withdraw tests.
    fn actor_balance_decreased_by(deployment: &Deployment, token: TestToken, amount: U256) -> bool {
        let initial_balance = match token {
            TestToken::Native => ACTOR_INITIAL_NATIVE_BALANCE,
            TestToken::ERC20 => ACTOR_INITIAL_ERC20_BALANCE,
        };
        get_balance(deployment, token, ACTOR_ADDRESS) == initial_balance - amount
    }

    const GAS_CONSUMPTION_NATIVE: u64 = 1989104;
    const GAS_CONSUMPTION_ERC20: u64 = 2024678;

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn gas_consumption_regression(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);

        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, token, &calldata).unwrap();

        let expected_gas_used = match token {
            TestToken::Native => GAS_CONSUMPTION_NATIVE,
            TestToken::ERC20 => GAS_CONSUMPTION_ERC20,
        };
        assert!(
            gas_used < 110 * expected_gas_used / 100,
            "new account native transaction consumes {gas_used}, which is 10% beyond baseline of {expected_gas_used}"
        );
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn succeeds(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);

        let events = invoke_call(&mut deployment, &mut shielder_account, token, &calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::NewAccount(NewAccount {
                contractVersion: FixedBytes([0, 1, 0]),
                idHash: calldata.id_hash,
                tokenAddress: token.address(&mut deployment),
                amount,
                newNote: calldata.new_note,
                newNoteIndex: U256::ZERO,
            })]
        );
        assert!(actor_balance_decreased_by(&deployment, token, amount));
        assert_eq!(shielder_account.shielded_amount, U256::from(amount))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        calldata.expected_contract_version = FixedBytes([9, 8, 7]);

        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: FixedBytes([0, 1, 0]),
                    expectedByCaller: FixedBytes([9, 8, 7]),
                }
            ))
        );
        assert!(actor_balance_decreased_by(&deployment, token, U256::ZERO))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn cannot_use_same_id_twice(mut deployment: Deployment, #[case] token: TestToken) {
        assert!(
            create_account_and_call(&mut deployment, token, U256::from(1), U256::from(10)).is_ok()
        );

        let result = create_account_and_call(&mut deployment, token, U256::from(1), U256::from(10));

        assert_matches!(result, Err(ShielderContractErrors::DuplicatedNullifier(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(10)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn cannot_use_input_greater_than_field_modulus(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut shielder_account = ShielderAccount::new(U256::from(1));

        let initial_amount = U256::from(10);
        let mut calldata = prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            initial_amount,
        );
        let mut swap_value = U256::from_str(Fr::MODULUS).unwrap();

        mem::swap(&mut calldata.id_hash, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.id_hash, &mut swap_value);

        mem::swap(&mut calldata.new_note, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.new_note, &mut swap_value);

        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(0)
        ));
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn can_consume_entire_contract_balance_limit(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from((1u128 << 112) - 1);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);

        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);

        assert!(result.is_ok());
        let events = result.unwrap().0;
        assert!(events.len() == 1);
        assert_matches!(events[0], ShielderContractEvents::NewAccount(_));
        assert!(actor_balance_decreased_by(&deployment, token, amount))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_contract_balance_limit_reached(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let amount_1 = U256::from((1u128 << 112) - 1);
        assert!(create_account_and_call(&mut deployment, token, U256::from(1), amount_1).is_ok());

        let amount_2 = U256::from(1);
        let result_2 = create_account_and_call(&mut deployment, token, U256::from(2), amount_2);

        assert_matches!(
            result_2,
            Err(ShielderContractErrors::ContractBalanceLimitReached(_))
        );
        assert!(actor_balance_decreased_by(&deployment, token, amount_1))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_proof_incorrect(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        calldata.id_hash = calldata.id_hash.wrapping_add(U256::from(1));

        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::NewAccountVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(&deployment, token, U256::ZERO))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_over_deposit_limit(mut deployment: Deployment, #[case] token: TestToken) {
        use crate::limits::{get_deposit_limit, set_deposit_limit};

        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(101);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);

        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);

        assert!(result.is_ok());

        let old_limit = get_deposit_limit(&mut deployment);

        assert_eq!(old_limit, U256::MAX);

        let new_limit = U256::from(100);
        set_deposit_limit(&mut deployment, new_limit);

        let returned_new_limit = get_deposit_limit(&mut deployment);

        assert_eq!(returned_new_limit, new_limit);

        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(101);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, token, amount);

        let result = invoke_call(&mut deployment, &mut shielder_account, token, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::AmountOverDepositLimit(_))
        )
    }
}
