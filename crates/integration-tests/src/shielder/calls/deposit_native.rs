use alloy_primitives::{TxHash, U256};
use shielder_account::{
    call_data::{DepositCallType, MerkleProof},
    ShielderAccount,
};
use shielder_contract::ShielderContract::depositCall;

use crate::shielder::{
    deploy::Deployment, invoke_shielder_call, merkle::get_merkle_args, CallResult,
};
pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    amount: U256,
) -> (depositCall, U256) {
    let note_index = shielder_account
        .current_leaf_index()
        .expect("No leaf index");

    let (params, pk) = deployment.deposit_proving_params.clone();
    let (merkle_root, merkle_path) = get_merkle_args(
        deployment.contract_suite.shielder,
        note_index,
        &mut deployment.evm,
    );
    let calldata = shielder_account.prepare_call::<DepositCallType>(
        &params,
        &pk,
        amount,
        &MerkleProof {
            root: merkle_root,
            path: merkle_path,
        },
    );
    (calldata, note_index)
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    amount: U256,
    calldata: &depositCall,
) -> CallResult {
    let call_result = invoke_shielder_call(deployment, calldata, Some(amount));

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

    use alloy_primitives::{Address, Bytes, FixedBytes, U256};
    use evm_utils::SuccessResult;
    use halo2_proofs::halo2curves::ff::PrimeField;
    use rstest::rstest;
    use shielder_account::ShielderAccount;
    use shielder_circuits::F;
    use shielder_contract::ShielderContract::{
        depositCall, Deposit, ShielderContractErrors, ShielderContractEvents, WrongContractVersion,
    };

    use crate::{
        calls::deposit_native::{invoke_call, prepare_call},
        recipient_balance_increased_by, relayer_balance_increased_by,
        shielder::{
            actor_balance_decreased_by,
            calls::new_account_native,
            deploy::{deployment, Deployment},
            limits::{get_deposit_limit, set_deposit_limit},
        },
    };

    const GAS_CONSUMPTION: u64 = 1827769;

    #[rstest]
    fn gas_consumption_regression(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, amount, &calldata).unwrap();

        assert!(
        gas_used < 110 * GAS_CONSUMPTION / 100,
        "deposit transaction consumes {gas_used}, which is 10% beyond baseline of {GAS_CONSUMPTION}"
    );
    }

    #[rstest]
    fn succeeds(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (calldata, note_index) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let events = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::Deposit(Deposit {
                contractVersion: FixedBytes([0, 1, 0]),
                idHiding: calldata.idHiding,
                tokenAddress: Address::ZERO,
                amount: U256::from(amount),
                newNote: calldata.newNote,
                newNoteIndex: note_index.saturating_add(U256::from(1)),
            })]
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(15)));
        assert_eq!(shielder_account.shielded_amount, U256::from(15))
    }
    #[rstest]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();
        let (mut calldata, _) = prepare_call(&mut deployment, &mut shielder_account, U256::ZERO);
        calldata.expectedContractVersion = FixedBytes([9, 8, 7]);
        let result = invoke_call(
            &mut deployment,
            &mut shielder_account,
            U256::from(5),
            &calldata,
        );

        assert_matches!(
            result,
            Err(ShielderContractErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: FixedBytes([0, 1, 0]),
                    expectedByCaller: FixedBytes([9, 8, 7])
                }
            ))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(10)))
    }

    #[rstest]
    fn can_consume_entire_contract_balance_limit(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from((1u128 << 112) - 2),
        )
        .unwrap();

        let amount = U256::from(1);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert!(result.is_ok());
        assert!(actor_balance_decreased_by(
            &deployment,
            U256::from((1u128 << 112) - 1)
        ))
    }

    #[rstest]
    fn fails_if_contract_balance_limit_reached(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from((1u128 << 112) - 1),
        )
        .unwrap();

        let amount = U256::from(1);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::ContractBalanceLimitReached(_))
        );
        assert!(actor_balance_decreased_by(
            &deployment,
            U256::from((1u128 << 112) - 1)
        ))
    }

    #[rstest]
    fn cannot_use_same_note_twice(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let result_1 = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);
        assert!(result_1.is_ok());

        let result_2 = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result_2,
            Err(ShielderContractErrors::DuplicatedNullifier(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(15)))
    }

    #[rstest]
    fn cannot_use_input_greater_than_field_modulus(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (mut calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let mut swap_value = U256::from_str(F::MODULUS).unwrap();

        mem::swap(&mut calldata.oldNullifierHash, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.oldNullifierHash, &mut swap_value);

        mem::swap(&mut calldata.newNote, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.newNote, &mut swap_value);

        mem::swap(&mut calldata.idHiding, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.idHiding, &mut swap_value);

        assert!(actor_balance_decreased_by(&deployment, U256::from(10)));
        assert!(recipient_balance_increased_by(&deployment, U256::from(0)));
        assert!(relayer_balance_increased_by(&deployment, U256::from(0)))
    }

    #[rstest]
    fn fails_if_merkle_root_does_not_exist(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();

        let calldata = depositCall {
            expectedContractVersion: FixedBytes([0, 1, 0]),
            tokenAddress: Address::ZERO,
            amount: U256::from(10),
            idHiding: U256::ZERO,
            oldNullifierHash: U256::ZERO,
            newNote: U256::ZERO,
            merkleRoot: U256::ZERO,
            proof: Bytes::from(vec![]),
        };
        let result = invoke_call(
            &mut deployment,
            &mut shielder_account,
            U256::from(10),
            &calldata,
        );

        assert_matches!(
            result,
            Err(ShielderContractErrors::MerkleRootDoesNotExist(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::ZERO))
    }

    #[rstest]
    fn fails_if_proof_incorrect(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(10),
        )
        .unwrap();

        let amount = U256::from(5);
        let (mut calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        calldata.proof = Bytes::from(vec![]);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::DepositVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(10)))
    }

    #[rstest]
    fn rejects_value_zero(mut deployment: Deployment) {
        let initial_amount = U256::from(10);
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            initial_amount,
        )
        .unwrap();

        let amount = U256::ZERO;
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::ZeroAmount(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(10)))
    }

    #[rstest]
    fn fails_if_over_deposit_limit(mut deployment: Deployment) {
        let initial_amount = U256::from(101);
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            initial_amount,
        )
        .unwrap();

        let amount = U256::from(1);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert!(result.is_ok());

        let old_limit = get_deposit_limit(&mut deployment);

        assert_eq!(old_limit, U256::MAX);

        let new_limit = U256::from(100);
        set_deposit_limit(&mut deployment, new_limit);

        let returned_new_limit = get_deposit_limit(&mut deployment);

        assert_eq!(returned_new_limit, U256::from(100));

        let initial_amount = U256::from(10);
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(2),
            initial_amount,
        )
        .unwrap();

        let amount = U256::from(101);
        let (calldata, _) = prepare_call(&mut deployment, &mut shielder_account, amount);
        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::AmountOverDepositLimit(_))
        )
    }
}
