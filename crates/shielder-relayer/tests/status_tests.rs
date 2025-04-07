use axum::http::StatusCode;
use parameterized::parameterized;
use rust_decimal::Decimal;
use shielder_account::Token;
use shielder_relayer::TokenKind;

use crate::utils::{
    config::FEE_DESTINATION, container_logs, ensure_response, TestContext, ERC20_ADDRESS,
};

mod utils;

#[tokio::test]
async fn in_correct_setting_service_is_healthy_and_signers_have_funds() {
    let context = TestContext::default().await;

    let response = context.reach("health").await;
    ensure_response::<String>(response, StatusCode::OK, &String::from("Healthy"), &context).await;

    let metrics = context.get_metrics().await;
    ctx_assert!(
        metrics.contains(&format!(
            "signer_balances{{address=\"{}\"}} 20",
            context.signer.address()
        )),
        context
    );
}

#[tokio::test]
async fn server_provides_fee_address() {
    let context = TestContext::default().await;

    let response = context.reach("fee_address").await;
    ensure_response(
        response,
        StatusCode::OK,
        &String::from(FEE_DESTINATION),
        &context,
    )
    .await;
}

#[tokio::test]
async fn server_provides_max_pocket_money() {
    let context = TestContext::default().await;

    let response = context.reach("max_pocket_money").await;
    ensure_response(
        response,
        StatusCode::OK,
        &String::from("100000000000000000"),
        &context,
    )
    .await;
}

#[tokio::test]
async fn server_provides_supported_tokens() {
    let context = TestContext::default().await;

    let response = context.reach("supported_tokens").await;
    ensure_response(
        response,
        StatusCode::OK,
        &vec![
            TokenKind::Native,
            TokenKind::ERC20 {
                address: ERC20_ADDRESS,
                decimals: 18,
            },
        ],
        &context,
    )
    .await;
}

#[tokio::test]
async fn server_provides_api() {
    let context = TestContext::default().await;

    let response = context.reach("api").await;
    ctx_assert!(response.status().is_success(), context);

    let response = context.reach("api/openapi.json").await;
    ctx_assert!(response.status().is_success(), context);
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test)]
async fn server_returns_quotation(token: Token) {
    let context = TestContext::default().await;
    let quote = context.quote(token).await;
    assert_eq!(quote.native_token_unit_price, Decimal::new(1, 18));
    assert_eq!(quote.fee_token_unit_price, Decimal::new(1, 18));
}
