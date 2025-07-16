mod error;
mod handlers;
mod command_line_args;

use std::{sync::Arc, time::Duration};

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    serve, Router,
};

use error::ShielderProverServerError as Error;
use clap::Parser;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing::info;
use tracing_subscriber::{fmt, EnvFilter};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use crate::command_line_args::CommandLineArgs;
use crate::handlers as server_handlers;

#[derive(Debug)]
struct AppState {
    options: CommandLineArgs,
    task_pool: Arc<tokio_task_pool::Pool>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with(
            fmt::layer()
                .with_ansi(true)
                .with_timer(fmt::time::ChronoUtc::new("%Y-%m-%dT%H:%M:%S%.3fZ".into()))
                .with_span_events(fmt::format::FmtSpan::CLOSE),
        )
        .init();

    let options = CommandLineArgs::parse();

    let listener = TcpListener::bind((options.bind_address.clone(), options.public_port)).await?;
    let task_pool = tokio_task_pool::Pool::bounded(options.task_pool_capacity)
        .with_spawn_timeout(Duration::from_secs(options.task_pool_timeout_secs))
        .with_run_timeout(Duration::from_secs(options.tee_compute_timeout_secs))
        .into();

    let app = Router::new()
        .route("/health", get(server_handlers::health::health))
        .route(
            "/public_key",
            get(server_handlers::tee_public_key::tee_public_key),
        )
        .route(
            "/proof",
            post(server_handlers::generate_proof::generate_proof),
        )
        .layer(DefaultBodyLimit::max(options.maximum_request_size))
        .layer(CorsLayer::permissive())
        .with_state(AppState { options, task_pool }.into());

    info!("Starting local server on {}", listener.local_addr()?);
    serve(listener, app).await?;

    Ok(())
}
