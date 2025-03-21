use std::str::FromStr;

use alloy_primitives::{Address, TxHash, U256};
use shielder_account::{
    call_data::{DepositCall, DepositCallType, DepositExtra, Token},
    ShielderAccount,
};
use shielder_contract::ShielderContract::{depositERC20Call, depositNativeCall};

use crate::{
    deploy::ACTOR_ADDRESS,
    shielder::{deploy::Deployment, invoke_shielder_call, merkle::get_merkle_path, CallResult},
    TestToken,
};
pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    token: TestToken,
    amount: U256,
) -> (DepositCall, U256) {
    let note_index = shielder_account
        .current_leaf_index()
        .expect("No leaf index");

    let (params, pk) = deployment.deposit_proving_params.clone();
    let merkle_path = get_merkle_path(
        deployment.contract_suite.shielder,
        note_index,
        &mut deployment.evm,
    );
    let calldata = shielder_account.prepare_call::<DepositCallType>(
        &params,
        &pk,
        token.token(deployment),
        amount,
        &DepositExtra {
            merkle_path,
            mac_salt: U256::ZERO,
        },
    );
    (calldata, note_index)
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    calldata: &DepositCall,
) -> CallResult {
    let call_result = match calldata.token {
        Token::Native => {
            let amount = Some(calldata.amount);
            let calldata: depositNativeCall = calldata.clone().try_into().unwrap();
            invoke_shielder_call(deployment, &calldata, amount)
        }
        Token::ERC20(_) => {
            deployment
                .test_erc20
                .approve(
                    &mut deployment.evm,
                    Address::from_str(ACTOR_ADDRESS).unwrap(),
                    deployment.contract_suite.shielder,
                    calldata.amount,
                )
                .unwrap();

            let calldata: depositERC20Call = calldata.clone().try_into().unwrap();
            invoke_shielder_call(deployment, &calldata, None)
        }
    };

    match call_result {
        Ok((events, _success_result)) => {
            assert!(events.len() == 1);
            let event = events[0].clone();
            shielder_account.register_action((TxHash::default(), event.clone()));
            Ok((events, _success_result))
        }
        Err(err) => Err(err),
    }
}

#[cfg(test)]
mod tests {
    use std::{assert_matches::assert_matches, mem, str::FromStr};

    use alloy_primitives::{Bytes, FixedBytes, U256};
    use halo2_proofs::halo2curves::ff::PrimeField;
    use rstest::rstest;
    use shielder_account::{call_data::DepositCall, ShielderAccount};
    use shielder_circuits::Fr;
    use shielder_contract::ShielderContract::{
        Deposit, ShielderContractEvents, WrongContractVersion,
    };

    use crate::{
        actor_balance_decreased_by,
        call_errors::ShielderCallErrors,
        calls::deposit::{invoke_call, prepare_call},
        recipient_balance_increased_by,
        shielder::{
            calls::new_account,
            deploy::{deployment, Deployment},
            limits::{get_deposit_limit, set_deposit_limit},
        },
        TestToken,
    };

    const GAS_CONSUMPTION_NATIVE: u64 = 1793042;
    const GAS_CONSUMPTION_ERC20: u64 = 1810869;

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn gas_consumption_regression(mut deployment: Deployment, #[case] token: TestToken) {
        use evm_utils::SuccessResult;

        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, &calldata).unwrap();

        let expected_gas_used = match token {
            TestToken::Native => GAS_CONSUMPTION_NATIVE,
            TestToken::ERC20 => GAS_CONSUMPTION_ERC20,
        };

        assert!(
        gas_used < 110 * expected_gas_used / 100,
        "deposit transaction consumes {gas_used}, which is 10% beyond baseline of {expected_gas_used}"
    );
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn succeeds(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (calldata, note_index) =
            prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let events = invoke_call(&mut deployment, &mut shielder_account, &calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::Deposit(Deposit {
                contractVersion: FixedBytes([0, 1, 0]),
                tokenAddress: token.address(&deployment),
                amount: U256::from(amount),
                newNote: calldata.new_note,
                newNoteIndex: note_index.saturating_add(U256::from(1)),
                macSalt: U256::ZERO,
                macCommitment: calldata.mac_commitment,
            })]
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(15)
        ));
        assert_eq!(
            shielder_account.shielded_amount[&token.token(&deployment)],
            U256::from(15)
        )
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();
        let (mut calldata, _) =
            prepare_call(&mut deployment, &mut shielder_account, token, U256::ZERO);
        calldata.expected_contract_version = FixedBytes([9, 8, 7]);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: FixedBytes([0, 1, 0]),
                    expectedByCaller: FixedBytes([9, 8, 7])
                }
            ))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(10)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn can_consume_entire_contract_balance_limit(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from((1u128 << 112) - 2),
        )
        .unwrap();

        let amount = U256::from(1);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert!(result.is_ok());
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from((1u128 << 112) - 1)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_contract_balance_limit_reached(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from((1u128 << 112) - 1),
        )
        .unwrap();

        let amount = U256::from(1);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::ContractBalanceLimitReached(_))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from((1u128 << 112) - 1)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn cannot_use_same_note_twice(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let result_1 = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert!(result_1.is_ok());

        let result_2 = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result_2, Err(ShielderCallErrors::DuplicatedNullifier(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(15)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn cannot_use_input_greater_than_field_modulus(
        mut deployment: Deployment,
        #[case] token: TestToken,
    ) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (mut calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let mut swap_value = U256::from_str(Fr::MODULUS).unwrap();

        mem::swap(&mut calldata.old_nullifier_hash, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderCallErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.old_nullifier_hash, &mut swap_value);

        mem::swap(&mut calldata.new_note, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderCallErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.new_note, &mut swap_value);

        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(10)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            token,
            U256::from(0)
        ));
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_merkle_root_does_not_exist(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();

        let calldata = DepositCall {
            token: token.token(&deployment),
            amount: U256::from(10),
            expected_contract_version: FixedBytes([0, 1, 0]),
            old_nullifier_hash: U256::ZERO,
            new_note: U256::ZERO,
            merkle_root: U256::ZERO,
            mac_salt: U256::ZERO,
            mac_commitment: U256::ZERO,
            proof: Bytes::from(vec![]),
        };
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::MerkleRootDoesNotExist(_)));
        assert!(actor_balance_decreased_by(&deployment, token, U256::ZERO))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_proof_incorrect(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (mut calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        calldata.proof = Bytes::from(vec![]);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::DepositVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(10)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn rejects_value_zero(mut deployment: Deployment, #[case] token: TestToken) {
        let initial_amount = U256::from(10);
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            initial_amount,
        )
        .unwrap();

        let amount = U256::ZERO;
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::ZeroAmount(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(10)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_over_deposit_limit(mut deployment: Deployment, #[case] token: TestToken) {
        let initial_amount = U256::from(101);
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            initial_amount,
        )
        .unwrap();

        let amount = U256::from(1);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert!(result.is_ok());

        let old_limit = get_deposit_limit(&mut deployment);

        assert_eq!(old_limit, U256::MAX);

        let new_limit = U256::from(100);
        set_deposit_limit(&mut deployment, new_limit);

        let returned_new_limit = get_deposit_limit(&mut deployment);

        assert_eq!(returned_new_limit, U256::from(100));

        let initial_amount = U256::from(10);
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(2),
            initial_amount,
        )
        .unwrap();

        let amount = U256::from(101);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, token, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::AmountOverDepositLimit(_)))
    }
}
