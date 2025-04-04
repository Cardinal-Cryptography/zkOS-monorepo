use parameterized::parameterized;
use reqwest::{Response, StatusCode};
use rust_decimal::Decimal;
use shielder_account::Token;
use shielder_relayer::{RelayResponse, SimpleServiceResponse};

use crate::utils::{
    config::{ShielderContract, TestConfig, SIGNER},
    container_logs, response_message, TestContext, ERC20_ADDRESS,
};

mod utils;

async fn simple_payload(response: Response) -> String {
    response_message::<SimpleServiceResponse>(response)
        .await
        .message
}

#[tokio::test(flavor = "multi_thread")]
async fn in_correct_setting_service_is_healthy_and_signers_have_funds() {
    let test_context = TestContext::default().await;

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

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test(flavor = "multi_thread"))]
async fn relay_query_without_quote_before_fails(token: Token) {
    let context = TestContext::default().await;
    let response = context.relay(Default::default(), token).await;

    ctx_assert_eq!(response.status(), StatusCode::BAD_REQUEST, context);
    ctx_assert_eq!(
        simple_payload(response).await,
        "Invalid quote (probably expired)",
        context
    );
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test(flavor = "multi_thread"))]
async fn server_returns_quotation(token: Token) {
    let context = TestContext::default().await;
    let quote = context.quote(token).await;
    assert_eq!(quote.native_token_unit_price, Decimal::new(1, 18));
    assert_eq!(quote.fee_token_unit_price, Decimal::new(1, 18));
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test(flavor = "multi_thread"))]
async fn when_contract_returns_ok_server_sings_success(token: Token) {
    let test_context = TestContext::default().await;
    let response = test_context.relay_with_quote(token).await;

    ctx_assert!(response.status().is_success(), test_context);
    response_message::<RelayResponse>(response).await;
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test(flavor = "multi_thread"))]
async fn when_contract_reverts_server_screams_failure(token: Token) {
    let config = TestConfig {
        shielder_contract: ShielderContract::Reverting,
        ..Default::default()
    };
    let test_context = TestContext::new(config).await;

    let response = test_context.relay_with_quote(token).await;

    ctx_assert_eq!(response.status(), StatusCode::BAD_REQUEST, test_context);
    ctx_assert_eq!(
        simple_payload(response).await,
        "Dry run failed",
        test_context
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn metrics_register_withdrawals() {
    let context = TestContext::default().await;

    context.relay_with_quote(Token::Native).await;
    context.relay_with_quote(Token::ERC20(ERC20_ADDRESS)).await;

    let metrics = context.get_metrics().await;
    ctx_assert!(
        metrics.contains("# TYPE withdraw_success counter\nwithdraw_success 2"),
        context
    );
}
