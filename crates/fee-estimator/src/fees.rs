use alloy_primitives::U256;
use alloy_provider::Provider;
use anyhow::Result;
use shielder_account::Token;
use shielder_contract::providers::create_simple_provider;

use crate::{
    config::ServiceConfig,
    shielder::{deposit::estimate_deposit_gas, new_account::estimate_new_account_gas},
};

#[derive(Clone, serde::Serialize)]
pub struct FeeResponse {
    pub native_new_account_gas: String,
    pub native_deposit_gas: String,
    pub erc20_new_account_gas: String,
    pub erc20_deposit_gas: String,
    pub gas_price_native: String,
    pub update_timestamp: i64,
}

/// Returns a FeeResponse with gas estimations computed concurrently.
pub async fn get_fee_values(config: ServiceConfig) -> Result<FeeResponse> {
    let provider = create_simple_provider(&config.rpc_url).await?;
    // Run all gas estimations and gas price fetch concurrently
    let (
        native_new_account_result,
        erc20_new_account_result,
        native_deposit_result,
        erc20_deposit_result,
        gas_price_result,
    ) = tokio::join!(
        estimate_new_account_gas(
            config.account_pk,
            config.empty_shielder_seed,
            config.rpc_url.clone(),
            config.contract_address,
            Token::Native,
            U256::from(1),
            config.protocol_deposit_fee_bps,
        ),
        estimate_new_account_gas(
            config.account_pk,
            config.empty_shielder_seed,
            config.rpc_url.clone(),
            config.contract_address,
            Token::ERC20(config.erc20_token_address),
            U256::from(1),
            config.protocol_deposit_fee_bps,
        ),
        estimate_deposit_gas(
            config.account_pk,
            config.created_shielder_seed_native,
            config.rpc_url.clone(),
            config.contract_address,
            Token::Native,
            U256::from(1),
            config.protocol_deposit_fee_bps,
        ),
        estimate_deposit_gas(
            config.account_pk,
            config.created_shielder_seed_erc20,
            config.rpc_url.clone(),
            config.contract_address,
            Token::ERC20(config.erc20_token_address),
            U256::from(1),
            config.protocol_deposit_fee_bps,
        ),
        provider.get_gas_price()
    );

    // Handle results and propagate any errors
    let native_new_account_gas = native_new_account_result?.to_string();
    let erc20_new_account_gas = erc20_new_account_result?.to_string();
    let native_deposit_gas = native_deposit_result?.to_string();
    let erc20_deposit_gas = erc20_deposit_result?.to_string();
    let gas_price_native = gas_price_result?.to_string();

    Ok(FeeResponse {
        native_new_account_gas,
        native_deposit_gas,
        erc20_new_account_gas,
        erc20_deposit_gas,
        gas_price_native,
        update_timestamp: time::OffsetDateTime::now_utc().unix_timestamp(),
    })
}
