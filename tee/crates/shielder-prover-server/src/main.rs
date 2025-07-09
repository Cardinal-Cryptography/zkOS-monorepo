mod error;
mod handlers;

use std::{sync::Arc, time::Duration};

use axum::{routing::get, serve, Router};
use axum::extract::DefaultBodyLimit;
use axum::routing::post;
use clap::Parser;
use log::{info};
use tokio::net::TcpListener;
use error::ShielderProverServerError as Error;
use crate::handlers as server_handlers;

#[derive(Parser, Debug, Clone)]
struct Options {
    #[arg(short, long, default_value = "3000")]
    port: u16,

    #[arg(short, long, default_value = "127.0.0.1")]
    bind_address: String,

    #[clap(long, default_value_t = vsock::VMADDR_CID_HOST)]
    tee_cid: u32,

    #[clap(long, default_value_t = 100)]
    task_pool_capacity: usize,

    /// Maximum request size (in bytes) sent to server
    #[clap(long, default_value_t = 100 * 1024)]
    maximum_request_size: usize,

    #[clap(long, default_value_t = 5)]
    task_pool_timeout_secs: u64,

    #[clap(long, default_value_t = 600)]
    tee_compute_timeout_secs: u64,
}

struct AppState {
    options: Options,
    task_pool: Arc<tokio_task_pool::Pool>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber::fmt::init();

    let options = Options::parse();

    let listener = TcpListener::bind((options.bind_address.clone(), options.port)).await?;
    let task_pool = tokio_task_pool::Pool::bounded(options.task_pool_capacity)
        .with_spawn_timeout(Duration::from_secs(options.task_pool_timeout_secs))
        .with_run_timeout(Duration::from_secs(options.tee_compute_timeout_secs))
        .into();

    let app = Router::new()
        .route("/health", get(server_handlers::health::health))
        .route("/public_key", get(server_handlers::tee_public_key::tee_public_key))
        .route("/proof", post(server_handlers::generate_proof::generate_proof))
        .layer(DefaultBodyLimit::max(options.maximum_request_size))
        .with_state(AppState { options, task_pool }.into());

    info!("Starting local server on {}", listener.local_addr()?);
    serve(listener, app).await?;

    Ok(())
}


