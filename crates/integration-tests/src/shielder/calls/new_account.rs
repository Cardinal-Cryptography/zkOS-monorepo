use std::str::FromStr;

use alloy_primitives::{Address, Bytes, TxHash, U256};
use shielder_account::{
    call_data::{NewAccountCall, NewAccountCallExtra, NewAccountCallType},
    ShielderAccount, Token,
};
use shielder_contract::ShielderContract::{newAccountERC20Call, newAccountNativeCall};
use shielder_setup::protocol_fee::compute_protocol_fee_from_gross;

use crate::{
    call_errors::ShielderCallErrors,
    deploy::{ACTOR_ADDRESS, ANONYMITY_REVOKER_PKEY},
    protocol_fees::get_protocol_deposit_fee_bps,
    shielder::{invoke_shielder_call, CallResult, Deployment},
    TestToken,
};

pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    token: TestToken,
    amount: U256,
    memo: Bytes,
) -> NewAccountCall {
    let (params, pk) = deployment.new_account_proving_params.clone();

    let protocol_fee_bps =
        get_protocol_deposit_fee_bps(deployment.contract_suite.shielder, &mut deployment.evm);
    let protocol_fee = compute_protocol_fee_from_gross(amount, protocol_fee_bps);

    shielder_account.prepare_call::<NewAccountCallType>(
        &params,
        &pk,
        token.token(deployment),
        amount,
        &NewAccountCallExtra {
            anonymity_revoker_public_key: ANONYMITY_REVOKER_PKEY,
            encryption_salt: U256::MAX,
            mac_salt: U256::ZERO,
            caller_address: Address::from_str(ACTOR_ADDRESS).unwrap(),
            protocol_fee,
            memo,
        },
    )
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    calldata: &NewAccountCall,
) -> CallResult {
    let call_result = match calldata.token {
        Token::Native => {
            let amount = Some(calldata.amount);
            let calldata: newAccountNativeCall = calldata.clone().try_into().unwrap();
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

            let calldata: newAccountERC20Call = calldata.clone().try_into().unwrap();
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
    memo: Bytes,
) -> Result<ShielderAccount, ShielderCallErrors> {
    let mut shielder_account = ShielderAccount::new(id, token.token(deployment));

    let calldata = prepare_call(
        deployment,
        &mut shielder_account,
        token,
        initial_amount,
        memo,
    );
    let result = invoke_call(deployment, &mut shielder_account, &calldata);

    match result {
        Ok(_) => Ok(shielder_account),
        Err(e) => Err(e),
    }
}

#[cfg(test)]
mod tests {
    use std::{assert_matches::assert_matches, mem, str::FromStr};

    use alloy_primitives::{Bytes, FixedBytes, U256};
    use evm_utils::SuccessResult;
    use halo2_proofs::halo2curves::ff::PrimeField;
    use rstest::rstest;
    use shielder_account::ShielderAccount;
    use shielder_circuits::Fr;
    use shielder_contract::ShielderContract::{
        NewAccount, ShielderContractEvents, WrongContractVersion,
    };
    use shielder_setup::{
        protocol_fee::compute_protocol_fee_from_gross, version::contract_version,
    };

    use crate::{
        call_errors::ShielderCallErrors,
        calls::new_account::{create_account_and_call, invoke_call, prepare_call, TestToken},
        deploy::{deployment, MEMO_BYTES, PROTOCOL_FEES, ZERO_MEMO_BYTES, ZERO_PROTOCOL_FEES},
        protocol_fee_receiver_balance_increased_by,
        protocol_fees::ProtocolFeesBps,
        shielder::{actor_balance_decreased_by, Deployment},
    };

    const GAS_CONSUMPTION_NATIVE: u64 = 1989104;
    const GAS_CONSUMPTION_ERC20: u64 = 2024678;

    #[rstest]
    #[case::native(TestToken::Native, ZERO_PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::erc20(TestToken::ERC20, ZERO_PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::native_fees(TestToken::Native, PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::erc20_fees(TestToken::ERC20, PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::native_memo(TestToken::Native, ZERO_PROTOCOL_FEES, MEMO_BYTES)]
    #[case::erc20_memo(TestToken::ERC20, ZERO_PROTOCOL_FEES, MEMO_BYTES)]
    fn gas_consumption_regression(
        mut deployment: Deployment,
        #[case] token: TestToken,
        #[case] protocol_fees_bps: ProtocolFeesBps,
        #[case] memo: Bytes,
    ) {
        deployment.set_protocol_fees(&protocol_fees_bps);
        let mut shielder_account = ShielderAccount::new(U256::from(1), token.token(&deployment));
        let amount = U256::from(10);
        let calldata = prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            amount,
            Bytes::from(memo),
        );

        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, &calldata).unwrap();

        let expected_gas_used = match token {
            TestToken::Native => GAS_CONSUMPTION_NATIVE,
            TestToken::ERC20 => GAS_CONSUMPTION_ERC20,
        };
        assert!(
            gas_used < 110 * expected_gas_used / 100,
            "new account transaction consumes {gas_used}, which is 10% beyond baseline of {expected_gas_used}"
        );
    }

    #[rstest]
    #[case::native(TestToken::Native, ZERO_PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::erc20(TestToken::ERC20, ZERO_PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::native_fees(TestToken::Native, PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::erc20_fees(TestToken::ERC20, PROTOCOL_FEES, ZERO_MEMO_BYTES)]
    #[case::native_memo(TestToken::Native, ZERO_PROTOCOL_FEES, MEMO_BYTES)]
    #[case::erc20_memo(TestToken::ERC20, ZERO_PROTOCOL_FEES, MEMO_BYTES)]
    fn succeeds(
        mut deployment: Deployment,
        #[case] token: TestToken,
        #[case] protocol_fees_bps: ProtocolFeesBps,
        #[case] memo: Bytes,
    ) {
        deployment.set_protocol_fees(&protocol_fees_bps);
        let mut shielder_account = ShielderAccount::new(U256::from(1), token.token(&deployment));
        let initial_amount = U256::from(100000);
        let initial_protocol_fee = compute_protocol_fee_from_gross(
            initial_amount,
            protocol_fees_bps.protocol_deposit_fee_bps,
        );
        let calldata = prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            initial_amount,
            memo,
        );

        let events = invoke_call(&mut deployment, &mut shielder_account, &calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::NewAccount(NewAccount {
                contractVersion: contract_version().to_bytes(),
                prenullifier: calldata.prenullifier,
                tokenAddress: token.address(&deployment),
                amount: initial_amount,
                newNote: calldata.new_note,
                newNoteIndex: U256::ZERO,
                macSalt: U256::ZERO,
                macCommitment: calldata.mac_commitment,
                protocolFee: initial_protocol_fee,
                memo: calldata.memo,
            })]
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            token,
            initial_amount,
        ));
        assert_eq!(
            shielder_account.shielded_amount,
            initial_amount - initial_protocol_fee
        );
        assert!(protocol_fee_receiver_balance_increased_by(
            &deployment,
            token,
            initial_protocol_fee
        ));
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment, #[case] token: TestToken) {
        let memo = ZERO_MEMO_BYTES;
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata =
            prepare_call(&mut deployment, &mut shielder_account, token, amount, memo);
        calldata.expected_contract_version = FixedBytes([9, 8, 7]);

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: _,
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
        assert!(create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
            ZERO_MEMO_BYTES
        )
        .is_ok());

        let result = create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            U256::from(10),
            ZERO_MEMO_BYTES,
        );

        assert_matches!(result, Err(ShielderCallErrors::DuplicatedNullifier(_)));
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
        let mut shielder_account = ShielderAccount::new(U256::from(1), token.token(&deployment));

        let initial_amount = U256::from(10);
        let mut calldata = prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            initial_amount,
            ZERO_MEMO_BYTES,
        );
        let mut swap_value = U256::from_str(Fr::MODULUS).unwrap();

        mem::swap(&mut calldata.prenullifier, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderCallErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.prenullifier, &mut swap_value);

        mem::swap(&mut calldata.new_note, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderCallErrors::NotAFieldElement(_)));
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
        let mut shielder_account = ShielderAccount::new(U256::from(1), token.token(&deployment));
        let amount = U256::from((1u128 << 112) - 1);
        let calldata = prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            amount,
            ZERO_MEMO_BYTES,
        );

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

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
        assert!(create_account_and_call(
            &mut deployment,
            token,
            U256::from(1),
            amount_1,
            ZERO_MEMO_BYTES
        )
        .is_ok());

        let amount_2 = U256::from(1);
        let result_2 = create_account_and_call(
            &mut deployment,
            token,
            U256::from(2),
            amount_2,
            ZERO_MEMO_BYTES,
        );

        assert_matches!(
            result_2,
            Err(ShielderCallErrors::ContractBalanceLimitReached(_))
        );
        assert!(actor_balance_decreased_by(&deployment, token, amount_1))
    }

    #[rstest]
    #[case::native(TestToken::Native)]
    #[case::erc20(TestToken::ERC20)]
    fn fails_if_proof_incorrect(mut deployment: Deployment, #[case] token: TestToken) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(
            &mut deployment,
            &mut shielder_account,
            token,
            amount,
            ZERO_MEMO_BYTES,
        );
        calldata.prenullifier = calldata.prenullifier.wrapping_add(U256::from(1));

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderCallErrors::NewAccountVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(&deployment, token, U256::ZERO))
    }
}
