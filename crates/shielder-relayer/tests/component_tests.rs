use parameterized::parameterized;
use reqwest::StatusCode;
use shielder_account::Token;

use crate::utils::{
    config::{ShielderContract, TestConfig},
    container_logs, ensure_response, TestContext, ERC20_ADDRESS,
};

mod utils;

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test)]
async fn relay_query_without_quote_before_fails(token: Token) {
    let context = TestContext::default().await;
    let response = context.relay(Default::default(), token).await;

    ensure_response(
        response,
        StatusCode::BAD_REQUEST,
        &String::from("Invalid quote (probably expired)"),
        &context,
    )
    .await;
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test)]
async fn when_contract_returns_ok_server_sings_success(token: Token) {
    let test_context = TestContext::default().await;
    let response = test_context.relay_with_quote(token).await;

    ctx_assert!(response.status().is_success(), test_context);
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test)]
async fn when_contract_reverts_server_screams_failure(token: Token) {
    let config = TestConfig {
        shielder_contract: ShielderContract::Reverting,
        ..Default::default()
    };
    let test_context = TestContext::new(config).await;

    let response = test_context.relay_with_quote(token).await;

    ensure_response(
        response,
        StatusCode::BAD_REQUEST,
        &String::from("Dry run failed"),
        &test_context,
    )
    .await;
}

#[tokio::test]
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
