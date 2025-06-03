use std::{
    sync::{Arc, Mutex},
    time::Duration,
};

use anyhow::Result;
use axum::{extract::State, response::IntoResponse, routing::get, Json, Router};
use tokio::time::interval;
use tower_http::cors::CorsLayer;

mod fees;
use fees::{get_fee_values, FeeResponse};

#[derive(Clone)]
pub struct AppState {
    pub fees: FeeResponse,
}

async fn start_fee_monitor(app_state: Arc<Mutex<AppState>>) -> Result<()> {
    let mut interval = interval(Duration::from_secs(60));
    let mut counter = 0;

    loop {
        interval.tick().await;

        // Update fees with mocked values that change each iteration
        counter = (counter + 1) % 3;
        let new_fees = get_fee_values(counter);

        // Update the shared state with new fees
        {
            let mut state = app_state.lock().unwrap();
            state.fees = new_fees;
        }

        println!("Fee monitor updated fees (set {})", counter);
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
    // Create the initial AppState with default values
    let app_state = Arc::new(Mutex::new(AppState {
        fees: get_fee_values(0),
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
