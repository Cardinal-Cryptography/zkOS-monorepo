use log::info;
use shielder_rewards_common::protocol::{Response, RewardServer, VSOCK_PORT};
use tokio::spawn;
use tokio_vsock::{VsockAddr, VsockListener, VsockStream, VMADDR_CID_ANY};

#[tokio::main]
async fn main() {
    env_logger::init();

    if let Err(e) = run_server().await {
        eprintln!("VSOCK Server error: {}", e);
    }
}

async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let listener = VsockListener::bind(VsockAddr::new(VMADDR_CID_ANY, VSOCK_PORT))?;

    loop {
        let (stream, _) = listener.accept().await?;
        spawn(handle_client(stream));
    }
}

async fn handle_client(stream: VsockStream) {
    let result = do_handle_client(stream).await;
    info!("Client disconnected: {:?}", result);
}

async fn do_handle_client(stream: VsockStream) -> Result<(), Box<dyn std::error::Error>> {
    let mut server: RewardServer = stream.into();

    loop {
        server
            .handle_request(async |_| Response::PublicKey {
                pubkey: "dummy_pubkey".to_string(),
            })
            .await?;
    }
}
