use std::str::FromStr;

use alloy_primitives::{Address, Bytes, TxHash, U256};
use shielder_account::{
    call_data::{WithdrawCall, WithdrawCallType, WithdrawExtra},
    ShielderAccount, Token,
};
use shielder_contract::ShielderContract::{withdrawERC20Call, withdrawNativeCall};
use shielder_setup::version::contract_version;

use crate::{
    shielder::{
        deploy::{Deployment, RECIPIENT_ADDRESS, RELAYER_ADDRESS},
        invoke_shielder_call,
        merkle::get_merkle_path,
        CallResult,
    },
    TestToken,
};

pub struct PrepareCallArgs {
    token: TestToken,
    amount: U256,
    withdraw_address: Address,
    relayer_address: Address,
    relayer_fee: U256,
    pocket_money: U256,
    memo: Bytes,
}

pub fn prepare_args(
    token: TestToken,
    amount: U256,
    relayer_fee: U256,
    pocket_money: U256,
    memo: Vec<u8>,
) -> PrepareCallArgs {
    PrepareCallArgs {
        token,
        amount,
        withdraw_address: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
        relayer_address: Address::from_str(RELAYER_ADDRESS).unwrap(),
        relayer_fee,
        pocket_money,
        memo: Bytes::from(memo),
    }
}

pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    args: PrepareCallArgs,
) -> (WithdrawCall, U256) {
    let note_index = shielder_account
        .current_leaf_index()
        .expect("No leaf index");

    let (params, pk) = deployment.withdraw_proving_params.clone();
    let merkle_path = get_merkle_path(
        deployment.contract_suite.shielder,
        note_index,
        &mut deployment.evm,
    );

    let calldata = shielder_account.prepare_call::<WithdrawCallType>(
        &params,
        &pk,
        args.token.token(deployment),
        U256::from(args.amount),
        &WithdrawExtra {
            merkle_path,
            to: args.withdraw_address,
            relayer_address: args.relayer_address,
            relayer_fee: args.relayer_fee,
            contract_version: contract_version(),
            chain_id: U256::from(1),
            mac_salt: U256::ZERO,
            pocket_money: args.pocket_money,
            memo: args.memo,
        },
    );

    (calldata, note_index)
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    calldata: &WithdrawCall,
) -> CallResult {
    let call_result = match calldata.token {
        Token::Native => {
            let calldata: withdrawNativeCall = calldata.clone().try_into().unwrap();
            invoke_shielder_call(deployment, &calldata, None)
        }
        Token::ERC20(_) => {
            let pocket_money = calldata.pocket_money;
            let calldata: withdrawERC20Call = calldata.clone().try_into().unwrap();
            invoke_shielder_call(deployment, &calldata, Some(pocket_money))
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

#[cfg(test)]
mod tests {
    use std::{assert_matches::assert_matches, mem, str::FromStr};

    use alloy_primitives::{Address, Bytes, FixedBytes, U256};
    use evm_utils::SuccessResult;
    use halo2_proofs::halo2curves::ff::PrimeField;
    use rstest::rstest;
    use shielder_account::{call_data::WithdrawCall, ShielderAccount};
    use shielder_circuits::Fr;
    use shielder_contract::ShielderContract::{
        ShielderContractEvents, Withdraw, WrongContractVersion,
    };
    use shielder_setup::version::contract_version;

    use crate::{
        call_errors::ShielderCallErrors,
        calls::{
            deposit,
            withdraw::{invoke_call, prepare_args, prepare_call, PrepareCallArgs},
        },
        shielder::{
            actor_balance_decreased_by,
            calls::new_account,
            deploy::{
                deployment, Deployment, RECIPIENT_ADDRESS, RELAYER_ADDRESS, REVERTING_ADDRESS,
            },
            destination_balances_unchanged, recipient_balance_increased_by,
            relayer_balance_increased_by,
        },
        TestToken,
    };

    const GAS_CONSUMPTION_NATIVE: u64 = 1862991;
    const GAS_CONSUMPTION_ERC20: u64 = 1853288;

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn gas_consumption_regression(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (withdraw_calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), U256::ZERO, vec![]),
        );
        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, &withdraw_calldata).unwrap();

        let expected_gas_used = match token {
            TestToken::Native => GAS_CONSUMPTION_NATIVE,
            TestToken::ERC20 => GAS_CONSUMPTION_ERC20,
        };

        assert!(
        gas_used < 110 * expected_gas_used / 100,
        "withdraw transaction consumes {gas_used}, which is 10% beyond baseline of {expected_gas_used}"
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
            U256::from(20),
        )
        .unwrap();

        let pocket_money = match token {
            TestToken::Native => U256::from(0),
            TestToken::ERC20 => U256::from(1),
        };

        let (withdraw_calldata, withdraw_note_index) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), pocket_money, vec![]),
        );
        let events = invoke_call(&mut deployment, &mut shielder_account, &withdraw_calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::Withdraw(Withdraw {
                contractVersion: FixedBytes([1, 1, 1]),
                tokenAddress: token.address(&deployment),
                amount: U256::from(5),
                withdrawalAddress: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
                newNote: withdraw_calldata.new_note,
                relayerAddress: Address::from_str(RELAYER_ADDRESS).unwrap(),
                newNoteIndex: withdraw_note_index.saturating_add(U256::from(1)),
                fee: U256::from(1),
                macSalt: U256::ZERO,
                macCommitment: withdraw_calldata.mac_commitment,
                pocketMoney: pocket_money,
                protocolFee: U256::ZERO,
                memo: Bytes::from(vec![]),
            })]
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            token,
            U256::from(4)
        ));

        if let TestToken::ERC20 = token {
            assert!(actor_balance_decreased_by(
                &deployment,
                TestToken::Native,
                pocket_money
            ));
            assert!(recipient_balance_increased_by(
                &deployment,
                TestToken::Native,
                pocket_money
            ));
        }
        assert!(relayer_balance_increased_by(
            &deployment,
            token,
            U256::from(1)
        ));
        assert_eq!(shielder_account.shielded_amount, U256::from(15))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn succeeds_after_deposit(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let deposit_amount = U256::from(10);
        let (deposit_calldata, _) = deposit::prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            deposit_amount,
        );
        deposit::invoke_call(&mut deployment, &mut shielder_account, &deposit_calldata).unwrap();

        let pocket_money = match token {
            TestToken::Native => U256::from(0),
            TestToken::ERC20 => U256::from(1),
        };

        let (withdraw_calldata, withdraw_note_index) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), pocket_money, vec![]),
        );
        let events = invoke_call(&mut deployment, &mut shielder_account, &withdraw_calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::Withdraw(Withdraw {
                contractVersion: FixedBytes([1, 1, 1]),
                tokenAddress: token.address(&deployment),
                amount: U256::from(5),
                withdrawalAddress: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
                newNote: withdraw_calldata.new_note,
                relayerAddress: Address::from_str(RELAYER_ADDRESS).unwrap(),
                newNoteIndex: withdraw_note_index.saturating_add(U256::from(1)),
                fee: U256::from(1),
                macSalt: U256::ZERO,
                macCommitment: withdraw_calldata.mac_commitment,
                pocketMoney: pocket_money,
                protocolFee: U256::ZERO,
                memo: Bytes::from(vec![]),
            })]
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(30)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            token,
            U256::from(4)
        ));
        if let TestToken::ERC20 = token {
            assert!(actor_balance_decreased_by(
                &deployment,
                TestToken::Native,
                pocket_money
            ));
            assert!(recipient_balance_increased_by(
                &deployment,
                TestToken::Native,
                pocket_money
            ));
        }
        assert!(relayer_balance_increased_by(
            &deployment,
            token,
            U256::from(1)
        ));
        assert_eq!(shielder_account.shielded_amount, U256::from(25))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_proof_incorrect(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), U256::ZERO, vec![]),
        );
        calldata.new_note = calldata.new_note.wrapping_add(U256::from(1));

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::WithdrawVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn rejects_value_zero(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(0), U256::from(1), U256::ZERO, vec![]),
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::ZeroAmount(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_fee_higher_than_amount(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(3), U256::from(3), U256::ZERO, vec![]),
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::FeeHigherThanAmount(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn accepts_max_amount(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from((1u128 << 112) - 1),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(
                token,
                U256::from((1u128 << 112) - 1),
                U256::from(1),
                U256::ZERO,
                vec![],
            ),
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert!(result.is_ok());
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from((1u128 << 112) - 1)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            token,
            U256::from((1u128 << 112) - 2)
        ));
        assert!(relayer_balance_increased_by(
            &deployment,
            token,
            U256::from(1)
        ))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn rejects_too_high_amount(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(2), U256::from(1), U256::ZERO, vec![]),
        );
        calldata.amount = U256::from(1u128 << 112);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::AmountTooHigh(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();

        let calldata = WithdrawCall {
            expected_contract_version: FixedBytes([9, 8, 7]),
            token: token.token(&deployment),
            withdrawal_address: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
            relayer_address: Address::from_str(RELAYER_ADDRESS).unwrap(),
            relayer_fee: U256::ZERO,
            amount: U256::from(10),
            merkle_root: U256::ZERO,
            old_nullifier_hash: U256::ZERO,
            new_note: U256::ZERO,
            proof: Bytes::from(vec![]),
            mac_salt: U256::ZERO,
            mac_commitment: U256::ZERO,
            pocket_money: U256::ZERO,
            memo: Bytes::from(vec![]),
        };
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: FixedBytes([1, 1, 1]),
                    expectedByCaller: FixedBytes([9, 8, 7]),
                }
            ))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(0)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_incorrect_pocket_money(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), U256::from(2), vec![]),
        );
        calldata.pocket_money = U256::from(1);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::WithdrawVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_merkle_root_does_not_exist(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();

        let calldata = WithdrawCall {
            expected_contract_version: contract_version().to_bytes(),
            token: token.token(&deployment),
            withdrawal_address: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
            relayer_address: Address::from_str(RELAYER_ADDRESS).unwrap(),
            relayer_fee: U256::ZERO,
            amount: U256::from(10),
            merkle_root: U256::ZERO,
            old_nullifier_hash: U256::ZERO,
            new_note: U256::ZERO,
            proof: Bytes::from(vec![]),
            mac_salt: U256::ZERO,
            mac_commitment: U256::ZERO,
            pocket_money: U256::ZERO,
            memo: Bytes::from(vec![]),
        };
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::MerkleRootDoesNotExist(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(0)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn cannot_use_same_note_twice(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), U256::ZERO, vec![]),
        );
        assert!(invoke_call(&mut deployment, &mut shielder_account, &calldata).is_ok());

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderCallErrors::DuplicatedNullifier(_)));
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            token,
            U256::from(4)
        ));
        assert!(relayer_balance_increased_by(
            &deployment,
            token,
            U256::from(1)
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
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(token, U256::from(5), U256::from(1), U256::ZERO, vec![]),
        );
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
            U256::from(20)
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
    #[case::erc20(TestToken::ERC20)]
    fn handles_withdraw_transfer_failure(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            PrepareCallArgs {
                withdraw_address: Address::from_str(REVERTING_ADDRESS).unwrap(),
                ..prepare_args(token, U256::from(5), U256::from(1), U256::ZERO, vec![])
            },
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        match token {
            TestToken::Native => {
                assert_matches!(result, Err(ShielderCallErrors::NativeTransferFailed(_)))
            }
            TestToken::ERC20 => assert_matches!(
                result,
                Err(ShielderCallErrors::DestinationTriggeredRevert())
            ),
        };
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn handles_fee_transfer_failure(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = new_account::create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            PrepareCallArgs {
                relayer_address: Address::from_str(REVERTING_ADDRESS).unwrap(),
                ..prepare_args(token, U256::from(5), U256::from(1), U256::ZERO, vec![])
            },
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        match token {
            TestToken::Native => {
                assert_matches!(result, Err(ShielderCallErrors::NativeTransferFailed(_)))
            }
            TestToken::ERC20 => assert_matches!(
                result,
                Err(ShielderCallErrors::DestinationTriggeredRevert())
            ),
        };
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            U256::from(20)
        ));
        assert!(destination_balances_unchanged(&deployment, token))
    }
}
