use std::{collections::HashMap, fmt::Debug, sync::Arc};

use alloy_provider::Provider;
use shielder_rust_sdk::{
    alloy_primitives::{Address, U256},
    contract::providers::create_simple_provider,
};
use tokio::sync::RwLock;

pub mod balance_monitor;
pub mod endpoints;

pub type Balances = Arc<HashMap<Address, RwLock<Option<U256>>>>;

/// Check if the RPC node is reachable.
pub async fn healthy(node_rpc_url: &str) -> Result<(), String> {
    match create_simple_provider(node_rpc_url).await {
        Ok(provider) => match provider.get_chain_id().await {
            Ok(_) => Ok(()),
            Err(err) => cannot_reach_rpc_node(err),
        },
        Err(err) => cannot_reach_rpc_node(err),
    }
}

fn cannot_reach_rpc_node<E: Debug>(err: E) -> Result<(), String> {
    Err(format!("Cannot reach RPC node: {err:?}"))
}
