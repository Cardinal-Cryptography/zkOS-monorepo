use std::time::Duration;

use crate::config::{enums::DryRunning, LoggingFormat, NoncePolicy};

pub const DEFAULT_LOGGING_FORMAT: LoggingFormat = LoggingFormat::Text;
pub const DEFAULT_HOST: &str = "0.0.0.0";
pub const DEFAULT_PORT: u16 = 4141;
pub const DEFAULT_METRICS_PORT: u16 = 9615;
pub const DEFAULT_BALANCE_MONITOR_INTERVAL: Duration = Duration::from_secs(15);
pub const DEFAULT_NONCE_POLICY: NoncePolicy = NoncePolicy::Caching;
pub const DEFAULT_DRY_RUNNING: DryRunning = DryRunning::Always;
pub const DEFAULT_RELAY_COUNT_FOR_RECHARGE: u32 = 20;
pub const DEFAULT_TOTAL_FEE: &str = "100_000_000_000_000_000"; // 0.1 TZERO
pub const DEFAULT_RELAY_GAS: u64 = 2_000_000; // an estimated amount of gas for a 'withdraw_native' call

const ONE_MINUTE_IN_SECONDS: u64 = 60;
pub const DEFAULT_PRICE_FEED_VALIDITY: Duration = Duration::from_secs(10 * ONE_MINUTE_IN_SECONDS);
pub const DEFAULT_PRICE_FEED_REFRESH_INTERVAL: Duration =
    Duration::from_secs(ONE_MINUTE_IN_SECONDS);
pub const DEFAULT_SERVICE_FEE_PERCENT: u32 = 15;
pub const DEFAULT_QUOTE_VALIDITY: Duration = Duration::from_secs(15);
pub const DEFAULT_MAX_POCKET_MONEY: &str = "100_000_000_000_000_000"; // 0.1 TZERO
