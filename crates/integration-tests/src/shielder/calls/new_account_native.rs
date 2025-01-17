use alloy_primitives::{TxHash, U256};
use shielder_account::{call_data::NewAccountCallType, ShielderAccount};
use shielder_contract::ShielderContract::{newAccountNativeCall, ShielderContractErrors};

use crate::shielder::{invoke_shielder_call, CallResult, Deployment};

pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    amount: U256,
) -> newAccountNativeCall {
    let (params, pk) = deployment.new_account_native_proving_params.clone();
    shielder_account.prepare_call::<NewAccountCallType>(&params, &pk, amount, &())
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    amount: U256,
    calldata: &newAccountNativeCall,
) -> CallResult {
    let call_result = invoke_shielder_call(deployment, calldata, Some(amount));

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
    id: U256,
    initial_amount: U256,
) -> Result<ShielderAccount, ShielderContractErrors> {
    let mut shielder_account = ShielderAccount::new(id);

    let calldata = prepare_call(deployment, &mut shielder_account, initial_amount);
    let result = invoke_call(deployment, &mut shielder_account, initial_amount, &calldata);

    match result {
        Ok(_) => Ok(shielder_account),
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
    use shielder_circuits::F;
    use shielder_contract::ShielderContract::{
        NewAccountNative, ShielderContractErrors, ShielderContractEvents, WrongContractVersion,
    };

    use crate::{
        calls::new_account_native::{create_account_and_call, invoke_call, prepare_call},
        deploy::deployment,
        recipient_balance_increased_by, relayer_balance_increased_by,
        shielder::{
            actor_balance_decreased_by,
            limits::{get_deposit_limit, set_deposit_limit},
            Deployment,
        },
    };

    const GAS_CONSUMPTION: u64 = 2000279;

    #[rstest]
    fn gas_consumption_regression(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, amount);

        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, amount, &calldata).unwrap();

        assert!(
        gas_used < 110 * GAS_CONSUMPTION / 100,
        "new account native transaction consumes {gas_used}, which is 10% beyond baseline of {GAS_CONSUMPTION}"
    );
    }

    #[rstest]
    fn succeeds(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, amount);

        let events = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::NewAccountNative(NewAccountNative {
                contractVersion: FixedBytes([0, 0, 1]),
                idHash: calldata.idHash,
                amount,
                newNote: calldata.newNote,
                newNoteIndex: U256::ZERO,
            })]
        );
        assert!(actor_balance_decreased_by(&deployment, amount));
        assert_eq!(shielder_account.shielded_amount, U256::from(amount))
    }

    #[rstest]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut shielder_account, amount);
        calldata.expectedContractVersion = FixedBytes([9, 8, 7]);

        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: FixedBytes([0, 0, 1]),
                    expectedByCaller: FixedBytes([9, 8, 7]),
                }
            ))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::ZERO))
    }

    #[rstest]
    fn cannot_use_same_id_twice(mut deployment: Deployment) {
        assert!(create_account_and_call(&mut deployment, U256::from(1), U256::from(10)).is_ok());

        let result = create_account_and_call(&mut deployment, U256::from(1), U256::from(10));

        assert_matches!(result, Err(ShielderContractErrors::DuplicatedNullifier(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(10)))
    }

    #[rstest]
    fn cannot_use_input_greater_than_field_modulus(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::new(U256::from(1));

        let initial_amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut shielder_account, initial_amount);
        let mut swap_value = U256::from_str(F::MODULUS).unwrap();

        mem::swap(&mut calldata.idHash, &mut swap_value);
        let result = invoke_call(
            &mut deployment,
            &mut shielder_account,
            initial_amount,
            &calldata,
        );
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.idHash, &mut swap_value);

        mem::swap(&mut calldata.newNote, &mut swap_value);
        let result = invoke_call(
            &mut deployment,
            &mut shielder_account,
            initial_amount,
            &calldata,
        );
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.newNote, &mut swap_value);

        assert!(actor_balance_decreased_by(&deployment, U256::from(0)));
        assert!(recipient_balance_increased_by(&deployment, U256::from(0)));
        assert!(relayer_balance_increased_by(&deployment, U256::from(0)))
    }

    #[rstest]
    fn can_consume_entire_contract_balance_limit(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from((1u128 << 112) - 1);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, amount);

        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert!(result.is_ok());
        let events = result.unwrap().0;
        assert!(events.len() == 1);
        assert_matches!(events[0], ShielderContractEvents::NewAccountNative(_));
        assert!(actor_balance_decreased_by(&deployment, amount))
    }

    #[rstest]
    fn fails_if_contract_balance_limit_reached(mut deployment: Deployment) {
        let amount_1 = U256::from((1u128 << 112) - 1);
        assert!(create_account_and_call(&mut deployment, U256::from(1), amount_1).is_ok());

        let amount_2 = U256::from(1);
        let result_2 = create_account_and_call(&mut deployment, U256::from(2), amount_2);

        assert_matches!(
            result_2,
            Err(ShielderContractErrors::ContractBalanceLimitReached(_))
        );
        assert!(actor_balance_decreased_by(&deployment, amount_1))
    }

    #[rstest]
    fn correctly_handles_max_u256_value(mut deployment: Deployment) {
        let result = create_account_and_call(&mut deployment, U256::from(1), U256::MAX);

        assert_matches!(
            result,
            Err(ShielderContractErrors::ContractBalanceLimitReached(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::ZERO))
    }

    #[rstest]
    fn fails_if_proof_incorrect(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(10);
        let mut calldata = prepare_call(&mut deployment, &mut shielder_account, amount);
        calldata.idHash = calldata.idHash.wrapping_add(U256::from(1));

        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::NewAccountVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::ZERO))
    }

    #[rstest]
    fn fails_if_over_deposit_limit(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(101);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, amount);

        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert!(result.is_ok());

        let old_limit = get_deposit_limit(&mut deployment);

        assert_eq!(old_limit, U256::MAX);

        let new_limit = U256::from(100);
        set_deposit_limit(&mut deployment, new_limit);

        let returned_new_limit = get_deposit_limit(&mut deployment);

        assert_eq!(returned_new_limit, new_limit);

        let mut shielder_account = ShielderAccount::default();
        let amount = U256::from(101);
        let calldata = prepare_call(&mut deployment, &mut shielder_account, amount);

        let result = invoke_call(&mut deployment, &mut shielder_account, amount, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::AmountOverDepositLimit(_))
        )
    }
}
