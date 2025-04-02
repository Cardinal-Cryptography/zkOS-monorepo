use std::time::Duration;

use crate::config::{enums::DryRunning, LoggingFormat, NoncePolicy};

pub const DEFAULT_LOGGING_FORMAT: LoggingFormat = LoggingFormat::Text;
pub const DEFAULT_HOST: &str = "0.0.0.0";
pub const DEFAULT_PORT: u16 = 4141;
pub const DEFAULT_METRICS_PORT: u16 = 9615;
pub const DEFAULT_BALANCE_MONITOR_INTERVAL: Duration = Duration::from_secs(15);
pub const DEFAULT_NONCE_POLICY: NoncePolicy = NoncePolicy::Caching;
pub const DEFAULT_DRY_RUNNING: DryRunning = DryRunning::Always;
pub const DEFAULT_RECHARGE_THRESHOLD: &str = "2_000_000_000_000_000_000"; // 2 TZERO
pub const DEFAULT_RECHARGE_AMOUNT: &str = "20_000_000_000_000_000_000"; // 20 TZERO
pub const DEFAULT_RELAY_GAS: u64 = 2_000_000; // an estimated amount of gas for a 'withdraw_native' call

pub const DEFAULT_PRICE_FEED_VALIDITY: Duration = Duration::from_secs(600);
pub const DEFAULT_PRICE_FEED_REFRESH_INTERVAL: Duration = Duration::from_secs(60);
pub const DEFAULT_SERVICE_FEE_PERCENT: u32 = 15;
pub const DEFAULT_QUOTE_VALIDITY: Duration = Duration::from_secs(15);
pub const DEFAULT_MAX_POCKET_MONEY: &str = "100_000_000_000_000_000"; // 0.1 TZERO
