#![allow(unused)]

use std::{net::TcpListener, str::FromStr};

use alloy_primitives::{Address, Bytes, U256};
use rand::Rng;
use reqwest::Response;
use serde::{Deserialize, Serialize};
use shielder_relayer::{Coin, FeeToken, RelayQuery};
use shielder_setup::version::contract_version;
use testcontainers::{
    core::IntoContainerPort, runners::AsyncRunner, ContainerAsync, ContainerRequest, Image,
    ImageExt, TestcontainersError,
};

use crate::{
    ctx_assert,
    utils::{
        config::{TestConfig, BASE_URL, FEE_DESTINATION, FEE_DESTINATION_KEY},
        relayer_image::RelayerImage,
    },
};

pub mod config;
pub mod relayer_image;

/// Dockerized testing environment.
pub struct TestContext {
    /// The running container with the relayer service.
    pub relayer_container: ContainerAsync<RelayerImage>,
    /// Exposed HTTP port of the relayer service.
    pub relayer_port: u16,
    /// Exposed HTTP port of the relayer's metrics.
    pub relayer_metrics_port: u16,
}

impl TestContext {
    /// Creates new `TestContext`.
    ///
    /// # Networking and ports
    ///
    /// We are all containers in the host network. Therefore, to allow for parallel test execution,
    /// we are choosing random ports (and ignoring potential conflicts).
    pub async fn new(test_config: TestConfig) -> Self {
        let port = get_free_port();
        let metrics_port = get_free_port();
        let relayer_container = ContainerRequest::from(RelayerImage::new(
            port,
            metrics_port,
            test_config.node_rpc_url.url(),
            test_config.shielder_contract.address(),
            FEE_DESTINATION_KEY.to_string(),
            test_config.relayer_signer.signing_key(),
            Coin::Eth,
        ));

        Self {
            relayer_container: start_container(relayer_container).await,
            relayer_port: port,
            relayer_metrics_port: metrics_port,
        }
    }

    pub async fn relay(&self) -> Response {
        reqwest::Client::new()
            .post(format!("{BASE_URL}:{}/relay", self.relayer_port))
            .json(&RelayQuery {
                expected_contract_version: contract_version().to_bytes(),
                id_hiding: U256::ZERO,
                amount: U256::from(1),
                withdraw_address: Address::from_str(FEE_DESTINATION).unwrap(),
                merkle_root: U256::ZERO,
                nullifier_hash: U256::ZERO,
                new_note: U256::ZERO,
                proof: Bytes::new(),
                fee_token: FeeToken::Native,
                fee_amount: U256::from_str("100_000_000_000_000_000").unwrap(),
                mac_salt: U256::ZERO,
                mac_commitment: U256::ZERO,
            })
            .send()
            .await
            .expect("Failed to reach relay endpoint")
    }

    pub async fn get_metrics(&self) -> String {
        let response = self.get("metrics", self.relayer_metrics_port).await;
        ctx_assert!(response.status().is_success(), self);
        response.text().await.unwrap()
    }

    pub async fn reach_health(&self) -> Response {
        self.get("health", self.relayer_port).await
    }

    async fn get(&self, path: &str, port: u16) -> Response {
        reqwest::Client::new()
            .get(format!("{BASE_URL}:{}/{path}", port))
            .send()
            .await
            .unwrap_or_else(|_| panic!("Failed to reach `{path}` endpoint"))
    }
}

fn get_free_port() -> u16 {
    // We go with a bounded number of attempts to avoid infinite loops in case of some network
    // issues.
    for _ in 0..100 {
        let port = rand::thread_rng().gen_range(10000..60000);
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
    }
    panic!("Failed to find a free port")
}

async fn start_container<I: Image>(container: ContainerRequest<I>) -> ContainerAsync<I> {
    container
        .with_network("host")
        .start()
        .await
        .expect("Failed to start container")
}

pub async fn response_message<ResponseBody: for<'a> Deserialize<'a>>(
    response: Response,
) -> ResponseBody {
    response
        .json::<ResponseBody>()
        .await
        .expect("Failed to get response json body")
}

pub async fn container_logs(container: &ContainerAsync<impl Image>) -> String {
    let mut logs = String::new();

    let mut handle_logs = |res: Result<Vec<u8>, TestcontainersError>, name| {
        let bytes = res.unwrap_or_else(|_| panic!("Failed to get container {name} logs"));
        logs += &format!(
            "Container {name} logs:\n{}",
            String::from_utf8_lossy(&bytes)
        );
    };

    handle_logs(container.stdout_to_vec().await, "stdout");
    handle_logs(container.stderr_to_vec().await, "stderr");

    logs
}

#[macro_export]
macro_rules! ctx_assert {
    ($cond:expr, $context:expr) => {
        assert!(
            $cond,
            "{}",
            container_logs(&$context.relayer_container).await
        );
    };
}

#[macro_export]
macro_rules! ctx_assert_eq {
    ($left:expr, $right:expr, $context:expr) => {
        assert_eq!(
            $left,
            $right,
            "{}",
            container_logs(&$context.relayer_container).await
        );
    };
}
