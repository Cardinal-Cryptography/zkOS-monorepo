use alloy_provider::Provider;
use axum::{extract::State, http::status::StatusCode, response::IntoResponse};
use shielder_relayer::{server_error, QuoteFeeResponse};
use shielder_rust_sdk::{alloy_primitives::U256, contract::providers::create_simple_provider};
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
            let relay_fee = std::cmp::max(U256::from(0), app_state.relayer_fee - base_fee);
            (StatusCode::OK, QuoteFeeResponse::from(base_fee, relay_fee)).into_response()
        }
        Err(err) => {
            error!("[UNEXPECTED] Fee quoter failed: {err}");
            server_error("Could not quote fees")
        }
    }
}
