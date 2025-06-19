use axum::{extract::State, response::IntoResponse};
use shielder_relayer::{
    server::{success, temporary_failure},
    SimpleServiceResponse,
};
use tracing::{debug, error};

use crate::AppState;

/// Check if the service is healthy and operational.
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Service is healthy", body = SimpleServiceResponse),
        (status = SERVICE_UNAVAILABLE, description = "Cannot reach RPC node", body = SimpleServiceResponse)
    )
)]
pub async fn health(app_state: State<AppState>) -> impl IntoResponse {
    debug!("Healthcheck request received");
    match app_state.rpc_monitor.is_healthy().await {
        Ok(()) => success("Healthy"),
        Err(err) => {
            error!(err);
            temporary_failure(&err)
        }
    }
}
