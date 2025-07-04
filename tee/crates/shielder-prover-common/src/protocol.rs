use serde::{Deserialize, Serialize};

use crate::vsock::{VsockClient, VsockServer};

pub const VSOCK_PORT: u32 = 5000;

#[derive(Debug, Serialize, Deserialize)]
pub enum Request {
    Ping,
    TeePublicKey,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    Pong,
    TeePublicKey(Vec<u8>),
}

pub type ProverServer = VsockServer<Request, Response>;
pub type ProverClient = VsockClient<Request, Response>;
