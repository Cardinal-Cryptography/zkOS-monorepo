use axum::{routing::get, serve, Router};
use thiserror::Error;
use tokio::net::TcpListener;

#[derive(Error, Debug)]
enum Error {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let app = Router::new().route("/ping", get(ping));
    let listener = TcpListener::bind("0.0.0.0:3000").await?;

    serve(listener, app).await?;

    Ok(())
}

async fn ping() -> &'static str {
    "pong"
}
