// TODO: Rename to `new_account.rs` since no longer testing just native.

use std::str::FromStr;

use alloy_primitives::{Address, TxHash, U256};
use shielder_account::{call_data::NewAccountCallType, ShielderAccount};
use shielder_contract::ShielderContract::{newAccountCall, ShielderContractErrors};

use crate::{
    deploy::ACTOR_ADDRESS,
    shielder::{invoke_shielder_call, CallResult, Deployment, TestToken},
};

pub fn prepare_call(
    deployment: &mut Deployment,
    account: &mut ShielderAccount,
    token: TestToken,
    amount: U256,
) -> newAccountCall {
    let (params, pk) = deployment.new_account_proving_params.clone();
    let mut calldata = account.prepare_call::<NewAccountCallType>(&params, &pk, amount, &());
    calldata.tokenAddress = token.address(deployment);
    calldata
}

// Invokes the `newAccount` call of the Shielder contract. Precedes the call with an appropriate
// token approval if applicable.
pub fn invoke_call(
    deployment: &mut Deployment,
    account: &mut ShielderAccount,
    token: TestToken,
    amount: U256,
    calldata: &newAccountCall,
) -> CallResult {
    let call_value = match token {
        TestToken::Native => Some(amount),
        TestToken::FakeERC20 => {
            deployment
                .fake_token
                .approve(
                    &mut deployment.evm,
                    Address::from_str(ACTOR_ADDRESS).unwrap(),
                    deployment.contract_suite.shielder,
                    amount,
                )
                .unwrap();
            None
        }
    };

    let call_result = invoke_shielder_call(deployment, calldata, call_value);

    match call_result {
        Ok((events, success_result)) => {
            assert!(events.len() == 1);
            let event = events[0].clone();
            account.register_action((TxHash::default(), event.clone()));
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
    let mut account = ShielderAccount::new(id);

    let calldata = prepare_call(deployment, &mut account, token, initial_amount);
    let result = invoke_call(deployment, &mut account, token, initial_amount, &calldata);

    match result {
        Ok(_) => Ok(account),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {

    use std::{assert_matches::assert_matches, mem, str::FromStr};

    use alloy_primitives::{FixedBytes, U256};
    use evm_utils::SuccessResult;
    use halo2_proofs::halo2curves::ff::PrimeField;
    use rstest::rstest;
    use shielder_account::ShielderAccount;
    use shielder_circuits::Fr;
    use shielder_contract::ShielderContract::{
        NewAccount, ShielderContractErrors, ShielderContractEvents, WrongContractVersion,
    };

    use crate::{
        calls::new_account_native::{create_account_and_call, invoke_call, prepare_call},
        deploy::deployment,
        recipient_balance_increased_by, relayer_balance_increased_by,
        shielder::{
            actor_balance_decreased_by,
            limits::{get_deposit_limit, set_deposit_limit},
            Deployment, TestToken,
        },
    };

    const GAS_CONSUMPTION: u64 = 2000279;

    #[rstest]
    #[case(TestToken::Native)]
    #[case(TestToken::FakeERC20)]
    fn gas_consumption_regression(mut deployment: Deployment, #[case] token: TestToken) {
        let mut account = ShielderAccount::default();
        let amount = U256::from(10);
        let calldata = prepare_call(&mut deployment, &mut account, token, amount);

        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut account, token, amount, &calldata).unwrap();

        assert!(
        gas_used < 110 * GAS_CONSUMPTION / 100,
        "new account native transaction consumes {gas_used}, which is 10% beyond baseline of {GAS_CONSUMPTION}"
    );
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::FakeERC20)]
    fn succeeds(mut deployment: Deployment, #[case] token: TestToken) {
        let mut account = ShielderAccount::default();
        let amount = U256::from(10);
        let calldata = prepare_call(&mut deployment, &mut account, token, amount);

        let events = invoke_call(&mut deployment, &mut account, token, amount, &calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::NewAccount(NewAccount {
                contractVersion: FixedBytes([0, 1, 0]),
                idHash: calldata.idHash,
                tokenAddress: token.address(&deployment),
                amount,
                newNote: calldata.newNote,
                newNoteIndex: U256::ZERO,
            })]
        );
        assert!(actor_balance_decreased_by(&deployment, token, amount));
        assert_eq!(account.shielded_amount, U256::from(amount))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::FakeERC20)]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment, #[case] token: TestToken) {
        let mut account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut account, token, amount);
        calldata.expectedContractVersion = FixedBytes([9, 8, 7]);

        let result = invoke_call(&mut deployment, &mut account, token, amount, &calldata);

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
    #[case::erc20(TestToken::FakeERC20)]
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
    #[case::erc20(TestToken::FakeERC20)]
    fn cannot_use_input_greater_than_field_modulus(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut account = ShielderAccount::new(U256::from(1));

        let initial_amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut account, token, initial_amount);
        let mut swap_value = U256::from_str(Fr::MODULUS).unwrap();

        mem::swap(&mut calldata.idHash, &mut swap_value);
        let result = invoke_call(
            &mut deployment,
            &mut account,
            token,
            initial_amount,
            &calldata,
        );
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.idHash, &mut swap_value);

        mem::swap(&mut calldata.newNote, &mut swap_value);
        let result = invoke_call(
            &mut deployment,
            &mut account,
            token,
            initial_amount,
            &calldata,
        );
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.newNote, &mut swap_value);

        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(0)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            token,
            U256::from(0)
        ));
        assert!(relayer_balance_increased_by(
            &deployment,
            token,
            U256::from(0)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::FakeERC20)]
    fn can_consume_entire_contract_balance_limit(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut account = ShielderAccount::default();
        let amount = U256::from((1u128 << 112) - 1);
        let calldata = prepare_call(&mut deployment, &mut account, token, amount);

        let result = invoke_call(&mut deployment, &mut account, token, amount, &calldata);

        assert!(result.is_ok());
        let events = result.unwrap().0;
        assert!(events.len() == 1);
        assert_matches!(events[0], ShielderContractEvents::NewAccount(_));
        assert!(actor_balance_decreased_by(&deployment, token, amount))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::FakeERC20)]
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
    #[case::erc20(TestToken::FakeERC20)]
    fn fails_if_proof_incorrect(mut deployment: Deployment, #[case] token: TestToken) {
        let mut account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut account, token, amount);
        calldata.idHash = calldata.idHash.wrapping_add(U256::from(1));

        let result = invoke_call(&mut deployment, &mut account, token, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::NewAccountVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(&deployment, token, U256::ZERO))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::FakeERC20)]
    fn fails_if_over_deposit_limit(mut deployment: Deployment, #[case] token: TestToken) {
        let mut account = ShielderAccount::default();
        let amount = U256::from(101);
        let calldata = prepare_call(&mut deployment, &mut account, token, amount);

        let result = invoke_call(&mut deployment, &mut account, token, amount, &calldata);

        assert!(result.is_ok());

        let old_limit = get_deposit_limit(&mut deployment);

        assert_eq!(old_limit, U256::MAX);

        let new_limit = U256::from(100);
        set_deposit_limit(&mut deployment, new_limit);

        let returned_new_limit = get_deposit_limit(&mut deployment);

        assert_eq!(returned_new_limit, new_limit);

        let mut account = ShielderAccount::default();
        let amount = U256::from(101);
        let calldata = prepare_call(&mut deployment, &mut account, token, amount);

        let result = invoke_call(&mut deployment, &mut account, token, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::AmountOverDepositLimit(_))
        )
    }
}
