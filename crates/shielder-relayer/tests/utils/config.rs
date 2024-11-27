use std::env;

/// Base URL of relayer: we are running containers in the network host mode.
pub const BASE_URL: &str = "http://127.0.0.1";
/// Public key of some already endowed account on the test network.
pub const FEE_DESTINATION: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
/// Corresponding private key.
pub const FEE_DESTINATION_KEY: &str =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
/// Public key of another already endowed account on the test network.
pub const SIGNER: &str = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
/// Corresponding private key.
pub const SIGNER_KEY: &str = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
/// Private key of an account with no funds.
pub const POOR_ADDRESS_SIGNING_KEY: &str =
    "0xfb50646599b16cb2e58b158f4b54d85a29d5fe4e210c6b6d5e0717dccd7c7584";
/// Corresponding address.
pub const POOR_ADDRESS: &str = "0x5e9428AC5Cf0FA8822372D8FeA88d548dc3F2Ef3";

fn get_env(name: &str) -> String {
    env::var(name).unwrap_or_else(|_| panic!("{name} env var is not set"))
}

#[derive(Copy, Clone)]
pub enum ShielderContract {
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

#[derive(Copy, Clone)]
pub enum RelayerSigner {
    Endowed,
    NotEndowed,
}

impl RelayerSigner {
    pub fn signing_key(&self) -> String {
        match self {
            RelayerSigner::Endowed => SIGNER_KEY.to_string(),
            RelayerSigner::NotEndowed => POOR_ADDRESS_SIGNING_KEY.to_string(),
        }
    }
}

#[derive(Copy, Clone)]
pub enum NodeRpcUrl {
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

#[derive(Copy, Clone)]
pub struct TestConfig {
    pub shielder_contract: ShielderContract,
    pub relayer_signer: RelayerSigner,
    pub node_rpc_url: NodeRpcUrl,
}
