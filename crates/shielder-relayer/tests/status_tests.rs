use parameterized::parameterized;
use rust_decimal::Decimal;
use shielder_account::Token;

use crate::utils::{
    container_logs, simple_payload, TestContext, ERC20_ADDRESS,
};

mod utils;

#[tokio::test]
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
        metrics.contains(&format!(
            "signer_balances{{address=\"{}\"}} 20",
            test_context.signer.address()
        )),
        test_context
    );
}

#[parameterized(token = { Token::Native, Token::ERC20(ERC20_ADDRESS) })]
#[parameterized_macro(tokio::test)]
async fn server_returns_quotation(token: Token) {
    let context = TestContext::default().await;
    let quote = context.quote(token).await;
    assert_eq!(quote.native_token_unit_price, Decimal::new(1, 18));
    assert_eq!(quote.fee_token_unit_price, Decimal::new(1, 18));
}
