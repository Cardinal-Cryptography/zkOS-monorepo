use serde::{Deserialize, Serialize};

use crate::vsock::{VsockClient, VsockServer};

pub const VSOCK_PORT: u32 = 5000;

#[derive(Serialize, Deserialize)]
pub enum Request {
    Ping,
}

#[derive(Serialize, Deserialize)]
pub enum Response {
    Pong,
}

pub type RewardServer = VsockServer<Request, Response>;
pub type RewardClient = VsockClient<Request, Response>;
