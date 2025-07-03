use std::str::FromStr;

use alloy_primitives::{hex::FromHex, Address, U256};
use anyhow::{anyhow, Result};
use sha3::Digest;

#[derive(Clone, Debug)]
pub struct ServiceConfig {
    pub rpc_url: String,
    pub contract_address: Address,
    pub account_pk: U256,
    pub empty_shielder_seed: U256,
    pub created_shielder_seed_native: U256,
    pub created_shielder_seed_erc20: U256,
    pub erc20_token_address: Address,
    pub fee_refresh_interval_millis: u64,
    pub server_address: String,
    pub protocol_deposit_fee_bps: U256,
    pub protocol_withdraw_fee_bps: U256,
}

pub fn resolve_env(env_name: &str) -> Result<String> {
    let result = std::env::var(env_name)
        .map_err(|_| anyhow!("Environment variable `{}` is not set", env_name))?;
    Ok(result)
}

pub fn config_from_env() -> Result<ServiceConfig> {
    let account_pk = U256::from_str(&resolve_env("ACCOUNT_PK")?)?;

    let empty_shielder_seed =
        U256::from_be_slice(sha3::Keccak256::digest(account_pk.to_be_bytes_vec()).as_slice());

    let created_shielder_seed_native = U256::from_be_slice(
        sha3::Keccak256::digest(empty_shielder_seed.to_be_bytes_vec()).as_slice(),
    );
    let created_shielder_seed_erc20 = U256::from_be_slice(
        sha3::Keccak256::digest(created_shielder_seed_native.to_be_bytes_vec()).as_slice(),
    );

    Ok(ServiceConfig {
        rpc_url: resolve_env("RPC_URL")?,
        contract_address: Address::from_hex(&resolve_env("CONTRACT_ADDRESS")?)
            .map_err(|_| anyhow!("Invalid contract address"))?,
        account_pk,
        empty_shielder_seed,
        created_shielder_seed_native,
        created_shielder_seed_erc20,
        erc20_token_address: Address::from_hex(&resolve_env("ERC20_TOKEN_ADDRESS")?)
            .map_err(|_| anyhow!("Invalid ERC20 token address"))?,
        fee_refresh_interval_millis: resolve_env("FEE_REFRESH_INTERVAL_MILLIS")?.parse::<u64>()?,
        server_address: resolve_env("SERVER_ADDRESS")?,
        protocol_deposit_fee_bps: resolve_env("PROTOCOL_DEPOSIT_FEE_BPS")?.parse::<U256>()?,
        protocol_withdraw_fee_bps: resolve_env("PROTOCOL_WITHDRAW_FEE_BPS")?.parse::<U256>()?,
    })
}
