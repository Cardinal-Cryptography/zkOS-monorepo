#![warn(unused_crate_dependencies)]

use std::{env, io, sync::Arc, time::Duration};

use anyhow::Result;
use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use config::{config_from_env, ServiceConfig};
use tokio::{sync::RwLock, time::interval};
use tower_http::cors::CorsLayer;

mod config;
mod fees;
mod shielder;

use fees::{get_fee_values, FeeResponse};
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

#[derive(Clone)]
pub struct AppState {
    pub service_config: ServiceConfig,
    pub fees: Arc<RwLock<FeeResponse>>,
}

async fn start_fee_monitor(app_state: Arc<AppState>) -> Result<()> {
    let service_config = app_state.service_config.clone();
    let mut interval = interval(Duration::from_millis(
        service_config.clone().fee_refresh_interval_millis,
    ));

    loop {
        interval.tick().await;

        info!("Fetching new fees...");

        let service_config = app_state.service_config.clone();

        // Update fees with mocked values that change each iterationlet service_config = service_config.clone();
        let new_fees = get_fee_values(service_config).await;

        if new_fees.is_err() {
            error!("Failed to fetch new fees: {:?}", new_fees.err());
            continue; // Skip this iteration if fetching fees fails
        }
        let new_fees = new_fees.unwrap();
        {
            let mut fees = app_state.fees.write().await;
            *fees = new_fees;
        }
    }
}

async fn start_main_server(address: String, app_state: Arc<AppState>) -> Result<()> {
    let state_for_router = app_state.clone();

    let app = Router::new()
        .route("/get_fees", get(get_fees))
        .route("/health", get(|| async { "OK" }))
        .with_state(Arc::clone(&state_for_router))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(address.clone()).await?;

    info!("Server is running on {address}");

    Ok(axum::serve(listener, app).await?)
}

#[tokio::main(flavor = "multi_thread", worker_threads = 4)]
async fn main() -> Result<()> {
    init_logging()?;
    let service_config = config_from_env()?;

    info!("Setting up server...");
    // Create the initial AppState with default values
    let app_state = Arc::new(AppState {
        service_config: service_config.clone(),
        fees: Arc::new(RwLock::new(get_fee_values(service_config.clone()).await?)),
    });

    // 1) Spawn the fee monitor as a background task:
    tokio::spawn({
        let app_state = Arc::clone(&app_state);
        async move {
            if let Err(e) = start_fee_monitor(app_state).await {
                error!("Fee monitor failed: {:?}", e);
            }
        }
    });

    // 2) Run the HTTP server in the main task:
    start_main_server(service_config.server_address, app_state).await?;

    Ok(())
}

async fn get_fees(app_state: State<Arc<AppState>>) -> impl IntoResponse {
    let fees = app_state.fees.read().await;
    Json(fees.clone())
}

fn init_logging() -> Result<()> {
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

    subscriber.try_init().map_err(|err| anyhow::anyhow!(err))
}
