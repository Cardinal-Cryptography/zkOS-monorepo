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
}

/// Returns a FeeResponse with mocked values.
pub async fn get_fee_values(config: &ServiceConfig) -> Result<FeeResponse> {
    let native_new_account_gas = estimate_new_account_gas(
        config.account_pk.clone(),
        config.empty_shielder_seed.clone(),
        config.rpc_url.clone(),
        config.contract_address,
        Token::Native,
        U256::from(1),
    )
    .await?
    .to_string();

    let erc20_new_account_gas = estimate_new_account_gas(
        config.account_pk.clone(),
        config.empty_shielder_seed.clone(),
        config.rpc_url.clone(),
        config.contract_address,
        Token::ERC20(config.erc20_token_address),
        U256::from(1),
    )
    .await?
    .to_string();

    let native_deposit_gas = estimate_deposit_gas(
        config.account_pk.clone(),
        config.created_shielder_seed_native.clone(),
        config.rpc_url.clone(),
        config.contract_address,
        Token::Native,
        U256::from(1),
    )
    .await?
    .to_string();

    let erc20_deposit_gas = estimate_deposit_gas(
        config.account_pk.clone(),
        config.created_shielder_seed_erc20.clone(),
        config.rpc_url.clone(),
        config.contract_address,
        Token::ERC20(config.erc20_token_address),
        U256::from(1),
    )
    .await?
    .to_string();

    let provider = create_simple_provider(&config.rpc_url).await?;

    let gas_price_native = provider.get_gas_price().await?.to_string();

    Ok(FeeResponse {
        native_new_account_gas,
        native_deposit_gas,
        erc20_new_account_gas,
        erc20_deposit_gas,
        gas_price_native,
    })
}
