use std::{ops::Div, time::Instant};

use anyhow::Result;
use axum::{
    extract::{MatchedPath, Request},
    middleware::Next,
    response::IntoResponse,
};
use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};
use shielder_rust_sdk::alloy_primitives::U256;
use shielder_setup::native_token::NATIVE_TOKEN_DECIMALS;

use crate::monitor::{healthy, Balances};

pub const TOTAL_REQUESTS_METRIC: &str = "http_requests_total";
pub const REQUEST_DURATION_METRIC: &str = "http_requests_duration_seconds";
pub const WITHDRAW_DRY_RUN_FAILURE: &str = "withdraw_dry_run_failure";
pub const WITHDRAW_FAILURE: &str = "withdraw_failure";
pub const WITHDRAW_SUCCESS: &str = "withdraw_success";
pub const HEALTH: &str = "health";
pub const SIGNER_BALANCES: &str = "signer_balances";

pub async fn prometheus_endpoint(
    metrics_handle: PrometheusHandle,
    node_rpc_url: String,
    balances: Balances,
) -> impl IntoResponse {
    metrics::gauge!(HEALTH).set(healthy(&node_rpc_url).await.is_ok() as u8 as f64);
    render_signer_balances(balances).await;

    metrics_handle.render()
}

async fn render_signer_balances(balances: Balances) {
    for (signer, balance) in balances.iter() {
        let balance = balance.read().await.unwrap_or_default();
        let tzero_balance = balance
            .div(U256::from(10u128.pow(NATIVE_TOKEN_DECIMALS as u32)))
            .to_string()
            .parse::<f64>()
            .unwrap_or(f64::NAN);
        metrics::gauge!(SIGNER_BALANCES, "address" => signer.to_string()).set(tzero_balance);
    }
}

/// Setup Prometheus metrics handle with custom histogram buckets etc.
///
/// Can be called only once, during server setup.
pub fn setup_metrics_handle() -> Result<PrometheusHandle> {
    const EXPONENTIAL_SECONDS: &[f64] = &[
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 20.0,
    ];

    Ok(PrometheusBuilder::new()
        .set_buckets_for_metric(
            Matcher::Full(REQUEST_DURATION_METRIC.to_string()),
            EXPONENTIAL_SECONDS,
        )?
        .install_recorder()?)
}

/// Middleware to record HTTP request metrics.
pub async fn request_metrics(req: Request, next: Next) -> impl IntoResponse {
    let path = get_request_path(&req);
    let method = req.method().clone();

    let start = Instant::now();
    let response = next.run(req).await;
    let latency = start.elapsed().as_secs_f64();

    let labels = [
        ("method", method.to_string()),
        ("path", path),
        ("status", response.status().as_u16().to_string()),
    ];

    metrics::counter!(TOTAL_REQUESTS_METRIC, &labels).increment(1);
    metrics::histogram!(REQUEST_DURATION_METRIC, &labels).record(latency);

    response
}

fn get_request_path(req: &Request) -> String {
    if let Some(matched_path) = req.extensions().get::<MatchedPath>() {
        matched_path.as_str().to_owned()
    } else {
        req.uri().path().to_owned()
    }
}
