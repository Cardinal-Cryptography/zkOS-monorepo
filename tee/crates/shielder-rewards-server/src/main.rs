use std::{sync::Arc, time::Duration};

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    serve, Json, Router,
};
use clap::Parser;
use log::debug;
use serde::Deserialize;
use shielder_rewards_common::protocol::{Request, Response, RewardClient, VSOCK_PORT};
use thiserror::Error;
use tokio::net::TcpListener;

#[derive(Error, Debug)]
enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("VSOCK error: {0}")]
    Vsock(#[from] shielder_rewards_common::vsock::Error),
}

#[derive(Parser, Debug, Clone)]
struct Options {
    #[arg(short, long, default_value = "3000")]
    port: u16,

    #[arg(short, long, default_value = "0.0.0.0")]
    bind_address: String,

    #[clap(long, default_value_t = vsock::VMADDR_CID_HOST)]
    tee_cid: u32,

    #[clap(long, default_value_t = 100)]
    task_pool_capacity: usize,

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
    env_logger::init();

    let options = Options::parse();

    let listener = TcpListener::bind((options.bind_address.clone(), options.port)).await?;
    let task_pool = tokio_task_pool::Pool::bounded(options.task_pool_capacity)
        .with_spawn_timeout(Duration::from_secs(options.task_pool_timeout_secs))
        .with_run_timeout(Duration::from_secs(options.tee_compute_timeout_secs))
        .into();

    let app = Router::new()
        .route("/pubkey", get(pubkey))
        .route("/submit", post(submit))
        .with_state(AppState { options, task_pool }.into());

    serve(listener, app).await?;

    Ok(())
}

#[derive(Debug, Clone, Deserialize)]
struct SubmitPayload {
    user: String,
    encrypted_viewing_key: String,
}

impl From<SubmitPayload> for Request {
    fn from(payload: SubmitPayload) -> Self {
        Request::CalculateTVL {
            user: payload.user,
            encrypted_viewing_key: payload.encrypted_viewing_key,
        }
    }
}

#[axum::debug_handler]
async fn submit(
    State(state): State<Arc<AppState>>,
    Json(submit): Json<SubmitPayload>,
) -> Result<(), StatusCode> {
    let task_pool = state.task_pool.clone();
    task_pool
        .spawn(request(state, submit.into()))
        .await
        .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;

    Ok(())
}

async fn pubkey(State(state): State<Arc<AppState>>) -> Result<Json<Response>, StatusCode> {
    request(state, Request::GetPublicKey).await
}

async fn request(state: Arc<AppState>, request: Request) -> Result<Json<Response>, StatusCode> {
    debug!("Sending TEE request: {:?}", request);

    let mut tee_client = RewardClient::new(state.options.tee_cid, VSOCK_PORT)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let response = tee_client
        .request(&request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    debug!("Got TEE response: {:?}", response);

    Ok(Json(response))
}
