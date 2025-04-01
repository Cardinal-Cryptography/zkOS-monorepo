use std::{env, io, str::FromStr, sync::Arc};

use alloy_provider::Provider;
use alloy_signer_local::PrivateKeySigner;
use anyhow::{anyhow, Result};
use axum::{extract::State, middleware, response::IntoResponse, routing::get, Json, Router};
use price_feed::{start_price_feed, Prices};
use shielder_contract::{
    alloy_primitives::{Address, U256},
    providers::create_provider_with_nonce_caching_signer,
    ConnectionPolicy, ShielderUser,
};
use shielder_relayer::{TokenInfo, TokenKind};
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::EnvFilter;
use utoipa::OpenApi;
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_swagger_ui::SwaggerUi;

use crate::{
    config::{resolve_config, ChainConfig, KeyConfig, LoggingFormat, NoncePolicy, ServerConfig},
    metrics::{prometheus_endpoint, setup_metrics_handle},
    monitor::{balance_monitor::balance_monitor, Balances},
    quote_cache::{garbage_collector_worker, QuoteCache},
    recharge::start_recharging_worker,
    relay::Taskmaster,
};

mod config;
mod metrics;
mod monitor;
mod price_feed;
mod quote;
mod quote_cache;
mod recharge;
mod relay;

#[derive(Clone)]
pub struct AppState {
    pub node_rpc_url: String,
    pub fee_destination: Address,
    pub relay_gas: u64,
    pub signer_addresses: Vec<Address>,
    pub taskmaster: Taskmaster,
    pub balances: Balances,
    pub prices: Prices,
    pub token_config: Vec<TokenInfo>,
    pub quote_cache: QuoteCache,
    pub max_pocket_money: U256,
    pub service_fee_percent: u32,
}

struct Signers {
    signers: Vec<PrivateKeySigner>,
    addresses: Vec<Address>,
    balances: Balances,
}

#[derive(OpenApi)]
#[openapi()]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<()> {
    let server_config = resolve_config();
    init_logging(server_config.logging_format)?;

    info!("Starting Shielder relayer.");
    info!("Server configuration:\n{server_config:#?}",);

    let signers = get_signer_info(&server_config.keys)?;
    let prices = Prices::new(
        &server_config.operations.token_config,
        server_config.operations.price_feed_validity,
        server_config.operations.price_feed_refresh_interval,
    );

    tokio::try_join!(
        balance_monitor(
            &server_config.chain.node_rpc_url,
            server_config.operations.balance_monitor_interval,
            signers.balances.clone(),
        ),
        start_metrics_server(&server_config, signers.balances.clone()),
        start_main_server(&server_config, signers, prices.clone()),
        start_price_feed(prices)
    )?;

    Ok(())
}

fn get_signer_info(config: &KeyConfig) -> Result<Signers> {
    let (signers, addresses) = parse_keys(&config.signing_keys)?;
    let balances = Arc::new(
        addresses
            .iter()
            .map(|address| (*address, Default::default()))
            .collect(),
    );
    Ok(Signers {
        signers,
        addresses,
        balances,
    })
}

async fn start_metrics_server(config: &ServerConfig, balances: Balances) -> Result<()> {
    let address = config.network.metrics_address();
    let listener = tokio::net::TcpListener::bind(address.clone()).await?;
    info!("Exposing metrics on {address}");

    let metrics_handle = setup_metrics_handle()?;
    let node_rpc_url = config.chain.node_rpc_url.clone();

    let app = Router::new()
        .route(
            "/metrics",
            get(move || prometheus_endpoint(metrics_handle, node_rpc_url, balances)),
        )
        .layer(CorsLayer::permissive());
    Ok(axum::serve(listener, app).await?)
}

async fn start_main_server(config: &ServerConfig, signers: Signers, prices: Prices) -> Result<()> {
    let address = config.network.main_address();
    let listener = tokio::net::TcpListener::bind(address.clone()).await?;
    info!("Listening on {address}");

    let fee_destination = signer(&config.keys.fee_destination_key)?;
    let fee_destination_address = fee_destination.address();

    let report_for_recharge = start_recharging_worker(
        config.chain.node_rpc_url.clone(),
        fee_destination,
        signers.addresses.len(),
        config.operations.relay_count_for_recharge,
        config.chain.total_fee,
    );

    let quote_cache = QuoteCache::new(config.operations.quote_validity);
    tokio::spawn(garbage_collector_worker(quote_cache.clone()));

    let state = AppState {
        node_rpc_url: config.chain.node_rpc_url.clone(),
        fee_destination: fee_destination_address,
        relay_gas: config.chain.relay_gas,
        balances: signers.balances,
        signer_addresses: signers.addresses,
        taskmaster: Taskmaster::new(
            build_shielder_users(
                signers.signers,
                &config.chain,
                config.operations.nonce_policy,
            )
            .await?,
            config.operations.dry_running,
            report_for_recharge,
        ),
        token_config: config.operations.token_config.clone(),
        prices,
        quote_cache,
        max_pocket_money: config.operations.max_pocket_money,
        service_fee_percent: config.operations.service_fee_percent,
    };

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(monitor::endpoints::health_endpoint))
        .routes(routes!(fee_address))
        .routes(routes!(supported_tokens))
        .routes(routes!(quote::quote_fees))
        .routes(routes!(relay::relay))
        .with_state(state.clone())
        .route_layer(middleware::from_fn(metrics::request_metrics))
        .split_for_parts();

    let app = router
        .merge(SwaggerUi::new("/api").url("/api/openapi.json", api.clone()))
        .layer(CorsLayer::permissive());
    Ok(axum::serve(listener, app).await?)
}

/// Get the address to which relay fees should be sent.
#[utoipa::path(
    get,
    path = "/fee_address",
    responses((status = 200, body = String))
)]
async fn fee_address(state: State<AppState>) -> impl IntoResponse {
    state.fee_destination.to_string()
}

/// Get information about the supported tokens.
#[utoipa::path(
    get,
    path = "/supported_tokens",
    responses((status = 200, body = [TokenKind]))
)]
async fn supported_tokens(state: State<AppState>) -> impl IntoResponse {
    Json(
        state
            .token_config
            .iter()
            .map(|t| t.kind)
            .collect::<Vec<_>>(),
    )
}

fn init_logging(format: LoggingFormat) -> Result<()> {
    const LOG_CONFIGURATION_ENVVAR: &str = "RUST_LOG";

    let filter = EnvFilter::new(
        env::var(LOG_CONFIGURATION_ENVVAR)
            .as_deref()
            .unwrap_or("info"),
    );

    let subscriber = tracing_subscriber::fmt()
        .with_writer(io::stdout)
        .with_target(true)
        .with_env_filter(filter);

    match format {
        LoggingFormat::Json => subscriber.json().try_init(),
        LoggingFormat::Text => subscriber.try_init(),
    }
    .map_err(|err| anyhow!(err))
}

fn parse_keys(keys: &[String]) -> Result<(Vec<PrivateKeySigner>, Vec<Address>)> {
    let signers = keys
        .iter()
        .map(|key| signer(key))
        .collect::<Result<Vec<_>>>()?;
    let addresses = signers.iter().map(|signer| signer.address()).collect();
    Ok((signers, addresses))
}

fn signer(signing_key: &str) -> Result<PrivateKeySigner> {
    PrivateKeySigner::from_str(signing_key)
        .map_err(|err| anyhow!("Failed to create signer - invalid signing key: {err:?}"))
}

async fn build_shielder_users(
    signers: Vec<PrivateKeySigner>,
    config: &ChainConfig,
    nonce_policy: NoncePolicy,
) -> Result<Vec<ShielderUser<impl Provider + Clone>>> {
    let mut shielder_users = vec![];
    for signer in signers {
        let policy = match nonce_policy {
            NoncePolicy::Caching => ConnectionPolicy::Keep {
                caller_address: signer.address(),
                provider: create_provider_with_nonce_caching_signer(&config.node_rpc_url, signer)
                    .await?,
            },
            NoncePolicy::Stateless => ConnectionPolicy::OnDemand {
                signer,
                rpc_url: config.node_rpc_url.clone(),
            },
        };
        shielder_users.push(ShielderUser::new(config.shielder_contract_address, policy));
    }
    Ok(shielder_users)
}
