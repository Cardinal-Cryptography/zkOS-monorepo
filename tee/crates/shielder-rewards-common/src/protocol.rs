use serde::{Deserialize, Serialize};

use crate::vsock::{VsockClient, VsockServer};

pub const VSOCK_PORT: u32 = 5000;

#[derive(Serialize, Deserialize)]
pub enum Request {
    GetPublicKey,
}

#[derive(Serialize, Deserialize)]
pub enum Response {
    PublicKey { pubkey: String },
}

pub type RewardServer = VsockServer<Request, Response>;
pub type RewardClient = VsockClient<Request, Response>;
