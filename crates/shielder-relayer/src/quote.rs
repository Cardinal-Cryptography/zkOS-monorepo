use alloy_provider::Provider;
use axum::{
    extract::State,
    http::status::StatusCode,
    response::{IntoResponse, Response},
};
use shielder_relayer::{server_error, QuoteFeeResponse};
use shielder_rust_sdk::{alloy_primitives::U256, contract::providers::create_simple_provider};
use tracing::error;

use crate::AppState;

pub async fn quote_fees(app_state: State<AppState>) -> impl IntoResponse {
    match quote_relayer_fees(
        app_state.relay_gas,
        app_state.relay_fee,
        &app_state.node_rpc_url,
    )
    .await
    {
        Ok(quoted_fees) => (
            StatusCode::OK,
            QuoteFeeResponse::from(quoted_fees.base_fee, quoted_fees.relay_fee),
        )
            .into_response(),
        Err(response) => response,
    }
}

pub struct QuotedFees {
    pub base_fee: U256,
    pub relay_fee: U256,
}

pub async fn quote_relayer_fees(
    relay_gas: u64,
    relay_fee: U256,
    node_rpc_url: &str,
) -> Result<QuotedFees, Response> {
    let provider = match create_simple_provider(node_rpc_url).await {
        Ok(provider) => provider,
        Err(err) => {
            error!("[UNEXPECTED] Failed to create provider: {err}");
            return Err(server_error("Failed to create provider").into_response());
        }
    };

    match provider.get_gas_price().await {
        Ok(current_gas_price) => Ok(QuotedFees {
            base_fee: U256::from(relay_gas) * U256::from(current_gas_price),
            relay_fee,
        }),
        Err(err) => {
            error!("[UNEXPECTED] Fee quoter failed: {err}");
            Err(server_error("Could not quote fees").into_response())
        }
    }
}
