use alloy_provider::Provider;
use axum::{extract::State, http::status::StatusCode, response::IntoResponse, Json};
use rust_decimal::Decimal;
use shielder_account::Token;
use shielder_contract::{alloy_primitives::U256, providers::create_simple_provider};
use shielder_relayer::{
    scale_u256, server_error, QuoteFeeQuery, QuoteFeeResponse, SimpleServiceResponse, TokenKind,
};
use time::OffsetDateTime;
use tracing::error;

use crate::{price_feed::Price, quote_cache::CachedQuote, AppState};

/// Get a quote for the fees associated with a relay.
#[utoipa::path(
    post,
    path = "/quote_fees",
    request_body(content = QuoteFeeQuery, description = "Query for fee quotation"),
    responses(
        (status = 200, description = "Quotation successful", body = QuoteFeeResponse),
        (status = INTERNAL_SERVER_ERROR, description = "Couldn't connect to chain, price feed or computed fee", body = SimpleServiceResponse)
    )
)]
pub async fn quote_fees(
    State(app_state): State<AppState>,
    Json(query): Json<QuoteFeeQuery>,
) -> impl IntoResponse {
    match _quote_fees(app_state, query).await {
        Ok(response) => (StatusCode::OK, Json(response)).into_response(),
        Err(err) => {
            error!(err);
            server_error(&err)
        }
    }
}

async fn _quote_fees(
    app_state: AppState,
    query: QuoteFeeQuery,
) -> Result<QuoteFeeResponse, String> {
    // Gas-related calculations.
    let gas_price = U256::from(get_gas_price(&app_state).await?);
    let required_gas = U256::from(app_state.relay_gas);
    let gas_cost_native = required_gas * gas_price;

    // Actual cost of performing the relay.
    let relayer_cost_native = gas_cost_native + query.pocket_money;

    // Relay commission.
    let commission_native = relayer_cost_native * U256::from(15) / U256::from(100);

    // Total cost for the user.
    let total_cost_native = relayer_cost_native + commission_native;

    // Token conversion.
    let prices = match query.fee_token {
        Token::Native => {
            let price = get_native_token_price(&app_state)?;
            Prices {
                fee_token_price: price.clone(),
                native_token_price: price,
                ratio: Decimal::ONE,
            }
        }
        erc20 @ Token::ERC20 { .. } => get_token_price(&app_state, erc20)?,
    };

    let cached_quote = CachedQuote {
        fee_token: query.fee_token,
        gas_price,
        native_token_price: prices.native_token_price.token_price,
        token_price_ratio: prices.ratio,
    };
    app_state
        .quote_cache
        .store_quote_response(cached_quote, OffsetDateTime::now_utc())
        .await;

    Ok(QuoteFeeResponse {
        total_fee: app_state.total_fee,
        base_fee: gas_cost_native,
        relay_fee: app_state.total_fee.saturating_sub(gas_cost_native),

        total_cost_native,
        total_cost_fee_token: scale_u256(total_cost_native, prices.ratio)?,

        gas_price,
        gas_cost_native,
        gas_cost_fee_token: scale_u256(gas_cost_native, prices.ratio)?,

        commission_native,
        commission_fee_token: scale_u256(commission_native, prices.ratio)?,

        native_token_price: prices.native_token_price.token_price,
        native_token_unit_price: prices.native_token_price.unit_price,
        fee_token_price: prices.fee_token_price.token_price,
        fee_token_unit_price: prices.fee_token_price.unit_price,
        token_price_ratio: prices.ratio,
    })
}

async fn get_gas_price(app_state: &AppState) -> Result<u128, String> {
    let provider = create_simple_provider(&app_state.node_rpc_url)
        .await
        .map_err(|err| format!("Failed to create provider: {err}"))?;

    provider
        .get_gas_price()
        .await
        .map_err(|err| format!("Failed to get gas price: {err}"))
}

struct Prices {
    fee_token_price: Price,
    native_token_price: Price,
    ratio: Decimal,
}

fn get_native_token_price(app_state: &AppState) -> Result<Price, String> {
    Ok(app_state
        .prices
        .price(TokenKind::Native)
        .ok_or("Native token price not available")?)
}

fn get_token_price(app_state: &AppState, token: Token) -> Result<Prices, String> {
    let native_token_price = get_native_token_price(app_state)?;

    let token_kind = app_state
        .token_config
        .iter()
        .find(|info| Token::from(info.kind) == token)
        .map(|info| info.kind)
        .ok_or_else(|| format!("Requested token fee is not supported: {token:?}"))?;

    let fee_token_price = app_state
        .prices
        .price(token_kind)
        .ok_or("Fee token price not available")?;

    let ratio = native_token_price.unit_price / fee_token_price.unit_price;

    Ok(Prices {
        fee_token_price,
        native_token_price,
        ratio,
    })
}
