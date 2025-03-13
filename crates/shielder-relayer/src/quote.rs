use alloy_provider::Provider;
use axum::{extract::State, http::status::StatusCode, response::IntoResponse, Json};
use shielder_contract::{alloy_primitives::U256, providers::create_simple_provider};
use shielder_relayer::{server_error, QuoteFeeResponse};
use tracing::error;

use crate::AppState;

pub async fn quote_fees(app_state: State<AppState>) -> impl IntoResponse {
    match _quote_fees(app_state).await {
        Ok(response) => (StatusCode::OK, response).into_response(),
        Err(err) => {
            error!(err);
            server_error(&err)
        }
    }
}

async fn _quote_fees(app_state: State<AppState>) -> Result<Json<QuoteFeeResponse>, String> {
    let provider = create_simple_provider(&app_state.node_rpc_url)
        .await
        .map_err(|err| format!("Failed to create provider: {err}"))?;

    let gas_price = provider
        .get_gas_price()
        .await
        .map_err(|err| format!("Failed to get gas price: {err}"))?;

    let base_fee = U256::from(app_state.relay_gas) * U256::from(gas_price);
    let relay_fee = app_state.total_fee.saturating_sub(base_fee);

    Ok(QuoteFeeResponse::from(
        app_state.total_fee,
        base_fee,
        relay_fee,
    ))
}
