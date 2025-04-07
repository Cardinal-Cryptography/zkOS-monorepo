use parameterized::parameterized;
use reqwest::Response;
use rust_decimal::Decimal;
use shielder_account::Token;

use crate::utils::{
    config::FEE_DESTINATION, container_logs, simple_payload, TestContext, ERC20_ADDRESS,
};

mod utils;

async fn ensure_response(response: Response, expected_payload: &str, context: &TestContext) {
    ctx_assert!(response.status().is_success(), context);
    ctx_assert_eq!(simple_payload(response).await, expected_payload, context);
}

#[tokio::test]
async fn in_correct_setting_service_is_healthy_and_signers_have_funds() {
    let context = TestContext::default().await;

    let response = context.reach("health").await;
    ensure_response(response, "Healthy", &context).await;

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
    ensure_response(response, FEE_DESTINATION, &context).await;
}

#[tokio::test]
async fn server_provides_max_pocket_money() {
    let context = TestContext::default().await;

    let response = context.reach("max_pocket_money").await;
    ensure_response(response, "100000000000000000", &context).await;
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test)]
async fn server_returns_quotation(token: Token) {
    let context = TestContext::default().await;
    let quote = context.quote(token).await;
    assert_eq!(quote.native_token_unit_price, Decimal::new(1, 18));
    assert_eq!(quote.fee_token_unit_price, Decimal::new(1, 18));
}
