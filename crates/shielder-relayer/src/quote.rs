use alloy_provider::Provider;
use axum::{extract::State, http::status::StatusCode, response::IntoResponse, Json};
use shielder_contract::{alloy_primitives::U256, providers::create_simple_provider};
use shielder_relayer::{server_error, QuoteFeeQuery, QuoteFeeResponse};
use tracing::error;

use crate::AppState;

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
    _query: QuoteFeeQuery,
) -> Result<QuoteFeeResponse, String> {
    let gas_price = get_gas_price(&app_state).await?;

    let base_fee = U256::from(app_state.relay_gas) * U256::from(gas_price);
    let relay_fee = app_state.total_fee.saturating_sub(base_fee);

    Ok(QuoteFeeResponse {
        total_fee: app_state.total_fee,
        base_fee,
        relay_fee,

        total_cost_native: U256::ZERO,
        total_cost_fee_token: U256::ZERO,
        gas_price: U256::ZERO,
        gas_cost_native: U256::ZERO,
        gas_cost_fee_token: U256::ZERO,
        commission_native: U256::ZERO,
        commission_fee_token: U256::ZERO,
        token_price: Default::default(),
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
