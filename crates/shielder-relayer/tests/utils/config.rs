use std::env;

/// Base URL of relayer: we are running containers in the network host mode.
pub const BASE_URL: &str = "http://127.0.0.1";
/// Public key of some already endowed account on the test network.
pub const FEE_DESTINATION: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
/// Corresponding private key.
pub const FEE_DESTINATION_KEY: &str =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
/// How often to check signer's balance - 1 second.
pub const BALANCE_MONITOR_INTERVAL: &str = "1";

fn get_env(name: &str) -> String {
    env::var(name).unwrap_or_else(|_| panic!("{name} env var is not set"))
}

#[derive(Copy, Clone, Default)]
pub enum ShielderContract {
    #[default]
    Accepting,
    Reverting,
}

impl ShielderContract {
    pub fn address(&self) -> String {
        let env_name = match self {
            ShielderContract::Accepting => "ACCEPTING_SHIELDER",
            ShielderContract::Reverting => "REVERTING_SHIELDER",
        };
        get_env(env_name)
    }
}

#[derive(Copy, Clone, Default)]
pub enum NodeRpcUrl {
    #[default]
    Valid,
    Unavailable,
}

impl NodeRpcUrl {
    pub fn url(&self) -> String {
        match self {
            NodeRpcUrl::Valid => get_env("NODE_RPC_URL"),
            NodeRpcUrl::Unavailable => String::from("https://non-existent.node/"),
        }
    }
}

#[derive(Copy, Clone, Default)]
pub struct TestConfig {
    pub shielder_contract: ShielderContract,
    pub node_rpc_url: NodeRpcUrl,
}
