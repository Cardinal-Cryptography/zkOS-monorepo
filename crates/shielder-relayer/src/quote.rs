use alloy_provider::Provider;
use axum::{extract::State, http::status::StatusCode, response::IntoResponse};
use shielder_contract::{alloy_primitives::U256, providers::create_simple_provider};
use shielder_relayer::{server_error, QuoteFeeResponse};
use tracing::error;

use crate::AppState;

pub async fn quote_fees(app_state: State<AppState>) -> impl IntoResponse {
    let provider = match create_simple_provider(&app_state.node_rpc_url).await {
        Ok(provider) => provider,
        Err(err) => {
            error!("[UNEXPECTED] Failed to create provider: {err}");
            return server_error("Failed to create provider");
        }
    };

    match provider.get_gas_price().await {
        Ok(current_gas_price) => {
            let base_fee = U256::from(app_state.relay_gas) * U256::from(current_gas_price);
            // if the difference is negative, tell them that we don't charge
            // in reality, we would lose money, cause 'base_fee' is higher than 'total_fee'
            let relay_fee = app_state.total_fee.saturating_sub(base_fee);
            (
                StatusCode::OK,
                QuoteFeeResponse::from(app_state.total_fee, base_fee, relay_fee),
            )
                .into_response()
        }
        Err(err) => {
            error!("[UNEXPECTED] Fee quoter failed: {err}");
            server_error("Could not quote fees")
        }
    }
}
