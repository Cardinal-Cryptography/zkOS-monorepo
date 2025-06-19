use std::{
    fmt::Debug,
    sync::Arc,
    time::{Duration, Instant},
};

use alloy_provider::Provider;
use parking_lot::Mutex;
use shielder_contract::providers::create_simple_provider;

#[derive(Clone)]
pub struct RpcMonitor {
    inner: Arc<Mutex<InnerRpcMonitor>>,
}

impl RpcMonitor {
    pub async fn new(cache_validity: Duration, rpc_url: String) -> Self {
        let is_healthy = healthy(&rpc_url).await;
        Self {
            inner: Arc::new(Mutex::new(InnerRpcMonitor {
                rpc_url,
                is_healthy,
                last_check_started: Instant::now(),
                cache_validity,
            })),
        }
    }

    pub async fn is_healthy(&self) -> Result<(), String> {
        let requires_update = {
            let mut inner = self.inner.lock();
            if inner.last_check_started.elapsed() > inner.cache_validity {
                // Below we update the time to avoid concurrent updates by multiple threads.
                inner.last_check_started = Instant::now();
                true
            } else {
                false
            }
        };
        if requires_update {
            self.update_health().await;
        }
        self.health()
    }

    async fn update_health(&self) {
        let url = self.inner.lock().rpc_url.clone();
        let is_healthy = healthy(&url).await;
        self.inner.lock().is_healthy = is_healthy;
    }

    fn health(&self) -> Result<(), String> {
        self.inner.lock().is_healthy.clone()
    }
}

struct InnerRpcMonitor {
    rpc_url: String,
    is_healthy: Result<(), String>,
    last_check_started: Instant,
    cache_validity: Duration,
}

/// Check if the RPC node is reachable.
async fn healthy_no_timeout(node_rpc_url: &str) -> Result<(), String> {
    match create_simple_provider(node_rpc_url).await {
        Ok(provider) => match provider.get_chain_id().await {
            Ok(_) => Ok(()),
            Err(err) => cannot_reach_rpc_node(err),
        },
        Err(err) => cannot_reach_rpc_node(err),
    }
}

async fn healthy(node_rpc_url: &str) -> Result<(), String> {
    let timeout_duration = Duration::from_secs(10);
    match tokio::time::timeout(timeout_duration, healthy_no_timeout(node_rpc_url)).await {
        Ok(result) => result,
        Err(_) => cannot_reach_rpc_node("timeout while checking RPC node health"),
    }
}

fn cannot_reach_rpc_node<E: Debug>(err: E) -> Result<(), String> {
    Err(format!("Cannot reach RPC node: {err:?}"))
}
