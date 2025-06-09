use std::{
    collections::{hash_map::Entry, HashMap},
    str::FromStr,
};

use alloy_primitives::{Address, U256};
use alloy_provider::{network::AnyNetwork, Provider};
use alloy_signer_local::PrivateKeySigner;
use alloy_transport::BoxTransport;
use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use shielder_account::{ShielderAccount, Token};
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_contract::{
    providers::create_simple_provider, ConnectionPolicy, ShielderContractError, ShielderUser,
};
use tracing::{debug, warn};
use type_conversions::{address_to_field, field_to_u256, u256_to_field};

/// The URL of the relayer RPC.
#[derive(Clone, Eq, PartialEq, Debug, Default, Deserialize, Serialize)]
pub struct RelayerRpcUrl {
    base_url: String,
}

impl RelayerRpcUrl {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    pub fn healthcheck_url(&self) -> String {
        format!("{}/health", self.base_url)
    }

    pub fn relay_url(&self) -> String {
        format!("{}/relay", self.base_url)
    }

    pub fn fees_url(&self) -> String {
        format!("{}/quote_fees", self.base_url)
    }

    pub fn fee_address_url(&self) -> String {
        format!("{}/fee_address", self.base_url)
    }

    pub async fn check_connection(&self) -> anyhow::Result<()> {
        let response = reqwest::get(self.healthcheck_url()).await?;
        if response.status().is_success() {
            debug!("Relayer healthcheck succeeded.");
            Ok(())
        } else {
            warn!("Relayer healthcheck failed.");
            Err(anyhow!("Relayer healthcheck failed."))
        }
    }
}

/// Application info that is kept locally.
///
/// WARNING: You SHOULD NOT use `Self::Default` in production, as this will set the seed to
/// zero, which is insecure and might get in conflict with other accounts (similarly set up)
#[derive(Clone, Eq, PartialEq, Debug, Default, Deserialize, Serialize)]
pub struct AppState {
    pub accounts: HashMap<Address, ShielderAccount>,
    pub node_rpc_url: String,
    pub contract_address: Address,
    pub relayer_rpc_url: RelayerRpcUrl,
    pub signing_key: String,
}

impl AppState {
    /// Create a new `AppState` with a given signing key, which will be used for both signing
    /// on-chain transactions and as a shielded account seed.
    ///
    /// Note: You SHOULD prefer using `Self::new` instead of `Default::default()`, unless you are
    /// writing single-actor tests.
    pub fn new(signing_key: &str) -> Self {
        Self {
            accounts: HashMap::new(),
            signing_key: signing_key.into(),
            ..Default::default()
        }
    }

    /// If the account for `token` does not exist, create a new one. For ZK ID use either the
    /// provided `zkid_seed` or the default one derived from the signing key.
    pub fn ensure_account_exist(&mut self, token: Token, zkid_seed: Option<U256>) {
        let zkid_seed = zkid_seed.unwrap_or_else(|| self.default_zkid_seed(token));
        if let Entry::Vacant(e) = self.accounts.entry(token.address()) {
            e.insert(ShielderAccount::new(zkid_seed, token));
        }
    }

    fn default_zkid_seed(&self, token: Token) -> U256 {
        let seed =
            U256::from_str(&self.signing_key).expect("Invalid key format - cannot cast to U256");
        field_to_u256(hash(&[
            u256_to_field(seed),
            address_to_field(token.address()),
        ]))
    }

    pub fn display_app_config(&self) -> String {
        format!(
            "
Node address:          {}
Contract address:      {}
Relayer url:           {}
Depositor signing key: {}",
            self.node_rpc_url,
            self.contract_address,
            self.relayer_rpc_url.relay_url(),
            self.signing_key
        )
    }

    pub fn create_shielder_user(&self) -> ShielderUser {
        let signer = PrivateKeySigner::from_str(&self.signing_key)
            .expect("Invalid key format - cannot cast to PrivateKeySigner");
        ShielderUser::new(
            self.contract_address,
            ConnectionPolicy::OnDemand {
                rpc_url: self.node_rpc_url.clone(),
                signer,
            },
        )
    }

    pub async fn create_simple_provider(
        &self,
    ) -> Result<impl Provider<BoxTransport, AnyNetwork>, ShielderContractError> {
        create_simple_provider(&self.node_rpc_url).await
    }
}
