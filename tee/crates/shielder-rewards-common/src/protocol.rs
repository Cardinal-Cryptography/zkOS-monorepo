use serde::{Deserialize, Serialize};

use crate::vsock::{VsockClient, VsockServer};

pub const VSOCK_PORT: u32 = 5000;

#[derive(Serialize, Deserialize)]
pub enum Request {
    Ping,
    CalculateReward { viewing_key_base64: String },
}

#[derive(Serialize, Deserialize)]
pub enum Response {
    Pong,
    CalculateReward { reward: String },
    Error { message: String },
}

pub type RewardServer = VsockServer<Request, Response>;
pub type RewardClient = VsockClient<Request, Response>;
