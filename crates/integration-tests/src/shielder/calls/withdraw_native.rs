use std::str::FromStr;

use alloy_primitives::{Address, TxHash, U256};
use shielder_account::{
    call_data::{MerkleProof, WithdrawCallType, WithdrawExtra},
    ShielderAccount,
};
use shielder_contract::ShielderContract::withdrawTokenCall;
use shielder_setup::version::ContractVersion;

use crate::shielder::{
    deploy::{Deployment, RECIPIENT_ADDRESS, RELAYER_ADDRESS},
    invoke_shielder_call,
    merkle::get_merkle_args,
    CallResult,
};

pub struct PrepareCallArgs {
    amount: U256,
    withdraw_address: Address,
    relayer_address: Address,
    relayer_fee: U256,
}

pub fn prepare_args(amount: U256, relayer_fee: U256) -> PrepareCallArgs {
    PrepareCallArgs {
        amount,
        withdraw_address: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
        relayer_address: Address::from_str(RELAYER_ADDRESS).unwrap(),
        relayer_fee,
    }
}

pub fn prepare_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    args: PrepareCallArgs,
) -> (withdrawTokenCall, U256) {
    let note_index = shielder_account
        .current_leaf_index()
        .expect("No leaf index");

    let (params, pk) = deployment.withdraw_proving_params.clone();
    let (merkle_root, merkle_path) = get_merkle_args(
        deployment.contract_suite.shielder,
        note_index,
        &mut deployment.evm,
    );

    let calldata = shielder_account.prepare_call::<WithdrawCallType>(
        &params,
        &pk,
        U256::from(args.amount),
        &WithdrawExtra {
            merkle_proof: MerkleProof {
                root: merkle_root,
                path: merkle_path,
            },
            to: args.withdraw_address,
            relayer_address: args.relayer_address,
            relayer_fee: args.relayer_fee,
            contract_version: ContractVersion {
                note_version: 0,
                circuit_version: 1,
                patch_version: 0,
            },
        },
    );

    (calldata, note_index)
}

pub fn invoke_call(
    deployment: &mut Deployment,
    shielder_account: &mut ShielderAccount,
    calldata: &withdrawTokenCall,
) -> CallResult {
    let call_result = invoke_shielder_call(deployment, calldata, None);

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
    use shielder_account::ShielderAccount;
    use shielder_circuits::F;
    use shielder_contract::ShielderContract::{
        withdrawTokenCall, ShielderContractErrors, ShielderContractEvents, Withdraw,
        WrongContractVersion,
    };

    use crate::{
        calls::withdraw_native::{invoke_call, prepare_args, prepare_call, PrepareCallArgs},
        shielder::{
            actor_balance_decreased_by,
            calls::{deposit_native, new_account_native},
            deploy::{
                deployment, Deployment, RECIPIENT_ADDRESS, RELAYER_ADDRESS, REVERTING_ADDRESS,
            },
            destination_balances_unchanged, recipient_balance_increased_by,
            relayer_balance_increased_by,
        },
    };

    const GAS_CONSUMPTION: u64 = 1898039;

    #[rstest]
    fn gas_consumption_regression(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (withdraw_calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(5), U256::from(1)),
        );
        let (_, SuccessResult { gas_used, .. }) =
            invoke_call(&mut deployment, &mut shielder_account, &withdraw_calldata).unwrap();

        assert!(
        gas_used < 110 * GAS_CONSUMPTION / 100,
        "withdraw native transaction consumes {gas_used}, which is 10% beyond baseline of {GAS_CONSUMPTION}"
    );
    }

    #[rstest]
    fn succeeds(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (withdraw_calldata, withdraw_note_index) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(5), U256::from(1)),
        );
        let events = invoke_call(&mut deployment, &mut shielder_account, &withdraw_calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::Withdraw(Withdraw {
                contractVersion: FixedBytes([0, 1, 0]),
                idHiding: withdraw_calldata.idHiding,
                tokenAddress: Address::ZERO,
                amount: U256::from(5),
                withdrawalAddress: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
                newNote: withdraw_calldata.newNote,
                relayerAddress: Address::from_str(RELAYER_ADDRESS).unwrap(),
                newNoteIndex: withdraw_note_index.saturating_add(U256::from(1)),
                fee: U256::from(1),
            })]
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(recipient_balance_increased_by(&deployment, U256::from(4)));
        assert!(relayer_balance_increased_by(&deployment, U256::from(1)));
        assert_eq!(shielder_account.shielded_amount, U256::from(15))
    }

    #[rstest]
    fn succeeds_after_deposit(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let deposit_amount = U256::from(10);
        let (deposit_calldata, _) =
            deposit_native::prepare_call(&mut deployment, &mut shielder_account, deposit_amount);
        deposit_native::invoke_call(
            &mut deployment,
            &mut shielder_account,
            deposit_amount,
            &deposit_calldata,
        )
        .unwrap();

        let (withdraw_calldata, withdraw_note_index) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(5), U256::from(1)),
        );
        let events = invoke_call(&mut deployment, &mut shielder_account, &withdraw_calldata)
            .unwrap()
            .0;

        assert_eq!(
            events,
            vec![ShielderContractEvents::Withdraw(Withdraw {
                contractVersion: FixedBytes([0, 1, 0]),
                idHiding: withdraw_calldata.idHiding,
                tokenAddress: Address::ZERO,
                amount: U256::from(5),
                withdrawalAddress: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
                newNote: withdraw_calldata.newNote,
                relayerAddress: Address::from_str(RELAYER_ADDRESS).unwrap(),
                newNoteIndex: withdraw_note_index.saturating_add(U256::from(1)),
                fee: U256::from(1),
            })]
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(30)));
        assert!(recipient_balance_increased_by(&deployment, U256::from(4)));
        assert!(relayer_balance_increased_by(&deployment, U256::from(1)));
        assert_eq!(shielder_account.shielded_amount, U256::from(25))
    }

    #[rstest]
    fn fails_if_proof_incorrect(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(5), U256::from(1)),
        );
        calldata.newNote = calldata.newNote.wrapping_add(U256::from(1));

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::WithdrawVerificationFailed(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn rejects_value_zero(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(0), U256::from(1)),
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::ZeroAmount(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn fails_if_fee_higher_than_amount(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(3), U256::from(3)),
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::FeeHigherThanAmount(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn accepts_max_amount(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from((1u128 << 112) - 1),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from((1u128 << 112) - 1), U256::from(1)),
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert!(result.is_ok());
        assert!(actor_balance_decreased_by(
            &deployment,
            U256::from((1u128 << 112) - 1)
        ));
        assert!(recipient_balance_increased_by(
            &deployment,
            U256::from((1u128 << 112) - 2)
        ));
        assert!(relayer_balance_increased_by(&deployment, U256::from(1)))
    }

    #[rstest]
    fn rejects_too_high_amount(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(2), U256::from(1)),
        );
        calldata.amount = U256::from(1u128 << 112);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::AmountTooHigh(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn fails_if_incorrect_expected_version(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();

        let calldata = withdrawTokenCall {
            expectedContractVersion: FixedBytes([9, 8, 7]),
            tokenAddress: Address::ZERO,
            idHiding: U256::ZERO,
            withdrawalAddress: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
            relayerAddress: Address::from_str(RELAYER_ADDRESS).unwrap(),
            relayerFee: U256::ZERO,
            amount: U256::from(10),
            merkleRoot: U256::ZERO,
            oldNullifierHash: U256::ZERO,
            newNote: U256::ZERO,
            proof: Bytes::from(vec![]),
        };
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::WrongContractVersion(
                WrongContractVersion {
                    actual: FixedBytes([0, 1, 0]),
                    expectedByCaller: FixedBytes([9, 8, 7]),
                }
            ))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(0)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn fails_if_merkle_root_does_not_exist(mut deployment: Deployment) {
        let mut shielder_account = ShielderAccount::default();

        let calldata = withdrawTokenCall {
            expectedContractVersion: FixedBytes([0, 1, 0]),
            tokenAddress: Address::ZERO,
            idHiding: U256::ZERO,
            withdrawalAddress: Address::from_str(RECIPIENT_ADDRESS).unwrap(),
            relayerAddress: Address::from_str(RELAYER_ADDRESS).unwrap(),
            relayerFee: U256::ZERO,
            amount: U256::from(10),
            merkleRoot: U256::ZERO,
            oldNullifierHash: U256::ZERO,
            newNote: U256::ZERO,
            proof: Bytes::from(vec![]),
        };
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(
            result,
            Err(ShielderContractErrors::MerkleRootDoesNotExist(_))
        );
        assert!(actor_balance_decreased_by(&deployment, U256::from(0)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn cannot_use_same_note_twice(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(5), U256::from(1)),
        );
        assert!(invoke_call(&mut deployment, &mut shielder_account, &calldata).is_ok());

        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::DuplicatedNullifier(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(recipient_balance_increased_by(&deployment, U256::from(4)));
        assert!(relayer_balance_increased_by(&deployment, U256::from(1)))
    }

    #[rstest]
    fn cannot_use_input_greater_than_field_modulus(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (mut calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            prepare_args(U256::from(5), U256::from(1)),
        );
        let mut swap_value = U256::from_str(F::MODULUS).unwrap();

        mem::swap(&mut calldata.oldNullifierHash, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.oldNullifierHash, &mut swap_value);

        mem::swap(&mut calldata.newNote, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.newNote, &mut swap_value);

        mem::swap(&mut calldata.idHiding, &mut swap_value);
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);
        assert_matches!(result, Err(ShielderContractErrors::NotAFieldElement(_)));
        mem::swap(&mut calldata.idHiding, &mut swap_value);

        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(recipient_balance_increased_by(&deployment, U256::from(0)));
        assert!(relayer_balance_increased_by(&deployment, U256::from(0)))
    }

    #[rstest]
    fn handles_withdraw_transfer_failure(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            PrepareCallArgs {
                withdraw_address: Address::from_str(REVERTING_ADDRESS).unwrap(),
                ..prepare_args(U256::from(5), U256::from(1))
            },
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::NativeTransferFailed(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(destination_balances_unchanged(&deployment))
    }

    #[rstest]
    fn handles_fee_transfer_failure(mut deployment: Deployment) {
        let mut shielder_account = new_account_native::create_account_and_call(
            &mut deployment,
            U256::from(1),
            U256::from(20),
        )
        .unwrap();

        let (calldata, _) = prepare_call(
            &mut deployment,
            &mut shielder_account,
            PrepareCallArgs {
                relayer_address: Address::from_str(REVERTING_ADDRESS).unwrap(),
                ..prepare_args(U256::from(5), U256::from(1))
            },
        );
        let result = invoke_call(&mut deployment, &mut shielder_account, &calldata);

        assert_matches!(result, Err(ShielderContractErrors::NativeTransferFailed(_)));
        assert!(actor_balance_decreased_by(&deployment, U256::from(20)));
        assert!(destination_balances_unchanged(&deployment))
    }
}
