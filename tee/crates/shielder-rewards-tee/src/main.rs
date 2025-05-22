use log::info;
use shielder_rewards_common::protocol::{Request, Response, RewardServer, VSOCK_PORT};
use shielder_rewards_tee::{rewards::calculate_reward, AppState};
use tokio::spawn;
use tokio_vsock::{VsockAddr, VsockListener, VsockStream, VMADDR_CID_ANY};

#[tokio::main]
async fn main() {
    env_logger::init();

    // TODO: Load app state from a file

    let app_state = AppState { txs: vec![] };

    if let Err(e) = run_server(&app_state).await {
        eprintln!("VSOCK Server error: {}", e);
    }
}

async fn run_server(app_state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let listener = VsockListener::bind(VsockAddr::new(VMADDR_CID_ANY, VSOCK_PORT))?;

    loop {
        let (stream, _) = listener.accept().await?;
        spawn(handle_client(stream, app_state.clone()));
    }
}

async fn handle_client(stream: VsockStream, app_state: AppState) {
    let result = do_handle_client(stream, &app_state).await;
    info!("Client disconnected: {:?}", result);
}

async fn do_handle_client(
    stream: VsockStream,
    app_state: &AppState,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut server: RewardServer = stream.into();

    loop {
        server
            .handle_request(async |command| match command {
                Request::Ping => Response::Pong,
                Request::CalculateReward { viewing_key_base64 } => {
                    handle_error(calculate_reward(viewing_key_base64, app_state).await)
                }
            })
            .await?;
    }
}

fn handle_error(result: Result<Response, Box<dyn std::error::Error>>) -> Response {
    match result {
        Ok(response) => response,
        Err(e) => {
            eprintln!("Error handling request: {}", e);
            Response::Error {
                message: "Internal server error".to_string(),
            }
        }
    }
}
