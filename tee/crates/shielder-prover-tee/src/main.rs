mod circuits;
mod server;
use log::info;
use shielder_prover_common::protocol::{VSOCK_PORT};
use shielder_prover_common::vsock::VsockError;

#[tokio::main]
async fn main() -> Result<(), VsockError> {
    tracing_subscriber::fmt::init();

    let server = server::Server::new(VSOCK_PORT)?;
    info!("Server listening on: {:?}", server.local_addr()?);

    loop {
        let (stream, _) = server.listener().accept().await?;

        let server_clone = server.clone();
        tokio::spawn(async move {
            server_clone.handle_client(stream).await;
        });
    }
}




