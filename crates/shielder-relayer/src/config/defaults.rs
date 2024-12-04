use crate::config::{enums::DryRunning, LoggingFormat, NoncePolicy};

pub const DEFAULT_LOGGING_FORMAT: LoggingFormat = LoggingFormat::Text;
pub const DEFAULT_HOST: &str = "0.0.0.0";
pub const DEFAULT_PORT: u16 = 4141;
pub const DEFAULT_METRICS_PORT: u16 = 9615;
pub const DEFAULT_BALANCE_MONITOR_INTERVAL_SECS: u64 = 60 * 15;
pub const DEFAULT_NONCE_POLICY: NoncePolicy = NoncePolicy::Caching;
pub const DEFAULT_DRY_RUNNING: DryRunning = DryRunning::Always;
pub const DEFAULT_RELAY_COUNT_FOR_RECHARGE: u32 = 20;
pub const DEFAULT_RELAY_FEE: &str = "20_000_000_000_000_000"; // 0.02 TZERO
pub const DEFAULT_RELAY_GAS: u64 = 2_000_000;
