use reqwest::{Response, StatusCode};
use shielder_relayer::{RelayResponse, SimpleServiceResponse};

use crate::utils::{
    config::{NodeRpcUrl, RelayerSigner, ShielderContract, TestConfig, POOR_ADDRESS, SIGNER},
    container_logs, response_message, TestContext,
};

mod utils;

async fn simple_payload(response: Response) -> String {
    response_message::<SimpleServiceResponse>(response)
        .await
        .message
}

fn standard_config() -> TestConfig {
    TestConfig {
        shielder_contract: ShielderContract::Accepting,
        relayer_signer: RelayerSigner::Endowed,
        node_rpc_url: NodeRpcUrl::Valid,
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn in_correct_setting_service_is_healthy_and_signers_have_funds() {
    let test_context = TestContext::new(standard_config()).await;

    let health_response = test_context.reach_health().await;
    ctx_assert!(health_response.status().is_success(), test_context);
    ctx_assert_eq!(
        simple_payload(health_response).await,
        "Healthy",
        test_context
    );

    let metrics = test_context.get_metrics().await;
    ctx_assert!(
        metrics.contains(&format!("signer_balances{{address=\"{SIGNER}\"}} 10000")),
        test_context
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn when_cannot_connect_to_chain_service_is_not_healthy_and_signers_have_no_balance() {
    let test_context = TestContext::new(TestConfig {
        node_rpc_url: NodeRpcUrl::Unavailable,
        ..standard_config()
    })
    .await;

    let health_response = test_context.reach_health().await;
    ctx_assert_eq!(
        health_response.status(),
        StatusCode::SERVICE_UNAVAILABLE,
        test_context
    );
    ctx_assert!(
        simple_payload(health_response)
            .await
            .starts_with("Cannot reach RPC node"),
        test_context
    );

    let metrics = test_context.get_metrics().await;
    ctx_assert!(
        metrics.contains(&format!("signer_balances{{address=\"{SIGNER}\"}} 0")),
        test_context
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn when_relayer_signer_does_not_have_enough_funds_service_is_healthy() {
    let config = TestConfig {
        relayer_signer: RelayerSigner::NotEndowed,
        ..standard_config()
    };
    let test_context = TestContext::new(config).await;

    let health_response = test_context.reach_health().await;
    ctx_assert!(health_response.status().is_success(), test_context);
    ctx_assert_eq!(
        simple_payload(health_response).await,
        "Healthy",
        test_context
    );

    let metrics = test_context.get_metrics().await;
    ctx_assert!(
        metrics.contains(&format!("signer_balances{{address=\"{POOR_ADDRESS}\"}} 0")),
        test_context
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn when_contract_returns_ok_server_sings_success() {
    let test_context = TestContext::new(standard_config()).await;
    let response = test_context.relay_with_quote().await;

    ctx_assert!(response.status().is_success(), test_context);
    response_message::<RelayResponse>(response).await;
}

#[tokio::test(flavor = "multi_thread")]
async fn when_contract_reverts_server_screams_failure() {
    let config = TestConfig {
        shielder_contract: ShielderContract::Reverting,
        ..standard_config()
    };
    let test_context = TestContext::new(config).await;
    let response = test_context.relay_with_quote().await;

    ctx_assert_eq!(response.status(), StatusCode::BAD_REQUEST, test_context);
    ctx_assert_eq!(
        simple_payload(response).await,
        "Dry run failed",
        test_context
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn metrics_register_withdrawals() {
    let context = TestContext::new(standard_config()).await;

    context.relay_with_quote().await;
    context.relay_with_quote().await;

    let metrics = context.get_metrics().await;
    ctx_assert!(
        metrics.contains("# TYPE withdraw_success counter\nwithdraw_success 2"),
        context
    );
}
