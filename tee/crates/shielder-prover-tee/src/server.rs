use std::sync::Arc;
use log::{debug, info};
use tokio_vsock::{VsockAddr, VsockListener, VsockStream, VMADDR_CID_ANY};
use shielder_prover_common::protocol::{ProverServer, Request, Response};
use shielder_prover_common::vsock::VsockError;
use ecies_encryption_lib::{generate_keypair};
use ecies_encryption_lib::utils::to_hex;

pub struct Server {
    private_key: Vec<u8>,
    public_key: Vec<u8>,

    listener: VsockListener,
}

impl Server {
    pub fn new(port: u32) -> Result<Arc<Self>, VsockError> {
        let address = VsockAddr::new(VMADDR_CID_ANY, port);
        let listener = VsockListener::bind(address)?;
        info!("Generating server's asymmetric keys...");

        let (private_key, public_key) = generate_keypair();
        info!("Server's public key: {}", to_hex(&public_key.to_bytes()));

        Ok(Arc::new(Self {
            listener,
            private_key: private_key.to_bytes(),
            public_key: public_key.to_bytes(),
        }))
    }

    pub fn local_addr(&self) -> Result<VsockAddr, VsockError> {
        Ok(self.listener.local_addr()?)
    }

    pub fn listener(&self) -> &VsockListener {
        &self.listener
    }

    pub fn public_key(&self) -> Vec<u8>{
        self.public_key.clone()
    }
    pub async fn handle_client(self: Arc<Self>, stream: VsockStream) {
        let result = self.do_handle_client(stream).await;
        debug!("Client disconnected: {:?}", result);
    }

    async fn do_handle_client(&self, stream: VsockStream) -> Result<(), VsockError> {
        let mut server: ProverServer = stream.into();

        loop {
            server
                .handle_request(async |request| match request {
                    Request::Ping => Response::Pong,
                    Request::TeePublicKey => Response::TeePublicKey(self.public_key()),
                })
                .await?;
        }
    }
}


