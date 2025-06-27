use serde::{Deserialize, Serialize};

use crate::vsock::{VsockClient, VsockServer};

pub const VSOCK_PORT: u32 = 5000;

#[derive(Debug, Serialize, Deserialize)]
pub enum Request {
    GetPublicKey,
    CalculateTVL {
        user: String,
        encrypted_viewing_key: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    PublicKey { pubkey: String },
    TVL { user: String, tvl: u64 },
}

pub type RewardServer = VsockServer<Request, Response>;
pub type RewardClient = VsockClient<Request, Response>;
