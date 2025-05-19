use std::sync::Arc;

use axum::{extract::State, http::StatusCode, routing::get, serve, Json, Router};
use clap::Parser;
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
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let options = Options::parse();

    let app = Router::new()
        .route("/pubkey", get(pubkey))
        .with_state(options.clone().into());

    let listener = TcpListener::bind((options.bind_address, options.port)).await?;

    serve(listener, app).await?;

    Ok(())
}

async fn pubkey(State(options): State<Arc<Options>>) -> Result<Json<Response>, StatusCode> {
    let mut tee_client = RewardClient::new(options.tee_cid, VSOCK_PORT)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let pubkey = tee_client
        .request(&Request::GetPublicKey)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(pubkey))
}
