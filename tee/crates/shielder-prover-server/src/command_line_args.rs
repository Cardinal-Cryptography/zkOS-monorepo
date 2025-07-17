use clap::Parser;

#[derive(Parser, Debug, Clone)]
pub struct CommandLineArgs {
    /// A port on whhich this serves listend to incoming HTTP connections.
    #[arg(short, long, default_value = "3000", env = "PUBLIC_PORT")]
    pub public_port: u16,

    /// Internal port on which host and tee applications talks to each other
    /// This is the part of the vsock endpoint, which is tee_cid:tee_port
    #[arg(short, long, default_value_t = shielder_prover_common::protocol::VSOCK_PORT, env = "TEE_PORT")]
    pub tee_port: u16,

    /// Local IPv4 address on which this server listens to incoming HTTP connections
    #[arg(short, long, default_value = "0.0.0.0", env = "BIND_ADDRESS")]
    pub bind_address: String,

    /// A context identifier on which this server and TEE server communicate with each other
    /// This is the part of the vsock endpoint, which is tee_cid:tee_port
    #[clap(long, default_value_t = vsock::VMADDR_CID_HOST, env = "TEE_CID")]
    pub tee_cid: u32,

    /// How many incoming requests can this server handle at once
    /// Do not raise it above 128 as this is the limit of vsock connections, at least
    /// for the rust lib used by this server
    #[clap(long, default_value_t = 100, env = "TASK_POOL_CAPACITY")]
    pub task_pool_capacity: usize,

    /// Maximum request size (in bytes) sent to server
    #[clap(long, default_value_t = 100 * 1024, env = "MAXIMUM_REQUEST_SIZE")]
    pub maximum_request_size: usize,

    /// How much time this server waits for a task pool to spawn a new task
    #[clap(long, default_value_t = 5, env = "TASK_POOL_TIMEOUT_SECS")]
    pub task_pool_timeout_secs: u64,

    /// How much time this server waits for a response from TEE
    #[clap(long, default_value_t = 60, env = "TEE_COMPUTE_TIMEOUT_SECS")]
    pub tee_compute_timeout_secs: u64,
}
