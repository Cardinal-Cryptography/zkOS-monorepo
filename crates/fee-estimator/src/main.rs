#![warn(unused_crate_dependencies)]

use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use anyhow::Result;
use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use config::{config_from_env, ServiceConfig};
use tokio::time::interval;
use tower_http::cors::CorsLayer;

mod config;
mod fees;
mod shielder;

use fees::{get_fee_values, FeeResponse};

#[derive(Clone)]
pub struct AppState {
    pub service_config: ServiceConfig,
    pub fees: FeeResponse,
}

async fn start_fee_monitor(app_state: Arc<Mutex<AppState>>) -> Result<()> {
    let service_config = {
        let state: std::sync::MutexGuard<'_, AppState> = app_state.lock().unwrap();
        state.service_config.clone()
    };
    let mut interval = interval(Duration::from_millis(
        service_config.clone().fee_refresh_interval_millis,
    ));

    loop {
        interval.tick().await;

        println!("Fetching new fees...");

        // Update fees with mocked values that change each iteration
        let new_fees = get_fee_values(&service_config).await;

        if new_fees.is_err() {
            eprintln!("Failed to fetch new fees: {:?}", new_fees.err());
            continue; // Skip this iteration if fetching fees fails
        }
        let new_fees = new_fees.unwrap();
        // Update the shared state with new fees
        {
            let mut state = app_state.lock().unwrap();
            state.fees = new_fees;
        }
    }
}

async fn start_main_server(app_state: Arc<Mutex<AppState>>) -> Result<()> {
    let state_for_router = app_state.clone();

    let app = Router::new()
        .route("/get_fees", get(|state| get_fees(state)))
        .with_state(Arc::clone(&state_for_router))
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind("localhost:3000").await?;

    println!("Server is running on http://localhost:3000");

    Ok(axum::serve(listener, app).await?)
}

#[tokio::main]
async fn main() -> Result<()> {
    let service_config = config_from_env()?;

    // Create the initial AppState with default values
    let app_state = Arc::new(Mutex::new(AppState {
        service_config: service_config.clone(),
        fees: get_fee_values(&service_config).await?,
    }));

    tokio::try_join!(
        start_fee_monitor(Arc::clone(&app_state)),
        start_main_server(Arc::clone(&app_state))
    )?;

    Ok(())
}

async fn get_fees(app_state: State<Arc<Mutex<AppState>>>) -> impl (IntoResponse) {
    let state = app_state.lock().unwrap();
    Json(state.fees.clone())
}
