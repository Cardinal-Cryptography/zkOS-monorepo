use std::time::Instant;

use alloy_primitives::{Address, U256};
use alloy_provider::Provider;
use anyhow::Result;
use axum::{
    extract::{MatchedPath, Request},
    middleware::Next,
    response::IntoResponse,
};
use metrics_exporter_prometheus::{Matcher, PrometheusBuilder, PrometheusHandle};
use shielder_contract::providers::create_simple_provider;
use shielder_setup::native_token::NATIVE_TOKEN_DECIMALS;

use crate::{
    monitor::{healthy, Balances},
    price_feed::Prices,
};

pub const TOTAL_REQUESTS_METRIC: &str = "http_requests_total";
pub const REQUEST_DURATION_METRIC: &str = "http_requests_duration_seconds";
pub const WITHDRAW_DRY_RUN_FAILURE: &str = "withdraw_dry_run_failure";
pub const WITHDRAW_FAILURE: &str = "withdraw_failure";
pub const WITHDRAW_SUCCESS: &str = "withdraw_success";
pub const HEALTH: &str = "health";
pub const SIGNER_BALANCES: &str = "signer_balances";
pub const FEE_DESTINATION_BALANCE: &str = "fee_destination_balance";
pub const EXPIRED_PRICE: &str = "expired_price";

pub async fn prometheus_endpoint(
    metrics_handle: PrometheusHandle,
    node_rpc_url: String,
    balances: Balances,
    fee_destination: Address,
    prices: Prices,
) -> impl IntoResponse {
    metrics::gauge!(HEALTH).set(healthy(&node_rpc_url).await.is_ok() as u8 as f64);
    render_signer_balances(balances).await;
    let _ = render_fee_destination_balance(&node_rpc_url, fee_destination).await;
    render_price_validity(&prices);

    metrics_handle.render()
}

fn u256_to_f64(value: U256) -> f64 {
    let pow2_64 = 2_f64.powi(64);
    value
        .into_limbs()
        .iter()
        .rev()
        .fold(0_f64, |acc, &limb| acc * pow2_64 + limb as f64)
}

async fn render_signer_balances(balances: Balances) {
    for (signer, balance) in balances.iter() {
        let unit_balance = balance.read().await.unwrap_or_default();
        metrics::gauge!(SIGNER_BALANCES, "address" => signer.to_string())
            .set(u256_to_f64(unit_balance) / 10f64.powi(NATIVE_TOKEN_DECIMALS as i32));
    }
}

async fn render_fee_destination_balance(
    node_rpc_url: &str,
    fee_destination: Address,
) -> Result<()> {
    let provider = create_simple_provider(node_rpc_url).await?;
    let balance = provider.get_balance(fee_destination).await?;
    metrics::gauge!(FEE_DESTINATION_BALANCE)
        .set(u256_to_f64(balance) / 10f64.powi(NATIVE_TOKEN_DECIMALS as i32));
    Ok(())
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

fn render_price_validity(prices: &Prices) {
    render_expired_prices(prices);
    render_price_ages(prices);
}

fn render_expired_prices(prices: &Prices) {
    let current_prices = prices.current_prices();
    for (token, price) in current_prices.iter() {
        let expired = match price {
            Some(_) => 0.0,
            None => 1.0,
        };
        metrics::gauge!(EXPIRED_PRICE, "token" => token.to_string()).set(expired);
    }
}

fn render_price_ages(_prices: &Prices) {}
