use alloy_primitives::{hex::FromHex, Address};
use anyhow::{anyhow, Result};

#[derive(Clone, Debug)]
pub struct ServiceConfig {
    pub rpc_url: String,
    pub contract_address: Address,
    pub empty_account_pk: String,
    pub created_account_pk: String,
    pub erc20_token_address: Address,
    pub fee_refresh_interval_millis: u64,
}

pub fn resolve_env(env_name: &str) -> Result<String> {
    let result = std::env::var(env_name)
        .map_err(|_| anyhow!("Environment variable `{}` is not set", env_name))?;
    Ok(result)
}

pub fn config_from_env() -> Result<ServiceConfig> {
    Ok(ServiceConfig {
        rpc_url: resolve_env("RPC_URL")?,
        contract_address: Address::from_hex(&resolve_env("CONTRACT_ADDRESS")?)
            .map_err(|_| anyhow!("Invalid contract address"))?,
        empty_account_pk: resolve_env("EMPTY_ACCOUNT_PK")?,
        created_account_pk: resolve_env("CREATED_ACCOUNT_PK")?,
        erc20_token_address: Address::from_hex(&resolve_env("ERC20_TOKEN_ADDRESS")?)
            .map_err(|_| anyhow!("Invalid ERC20 token address"))?,
        fee_refresh_interval_millis: resolve_env("FEE_REFRESH_INTERVAL_MILLIS")?.parse::<u64>()?,
    })
}
