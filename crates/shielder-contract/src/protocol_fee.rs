use alloy_primitives::U256;

use crate::{call_type::DryRun, ContractResult, ShielderUser};

pub async fn get_protocol_deposit_fee_bps(shielder_user: &ShielderUser) -> ContractResult<U256> {
    shielder_user.protocol_deposit_fee_bps::<DryRun>().await
}

pub async fn get_protocol_withdraw_fee_bps(shielder_user: &ShielderUser) -> ContractResult<U256> {
    shielder_user.protocol_withdraw_fee_bps::<DryRun>().await
}
