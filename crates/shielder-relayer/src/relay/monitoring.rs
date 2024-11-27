use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};

use tracing::warn;

use crate::relay::OPTIMISTIC_DRY_RUN_THRESHOLD;

pub trait RelayingMonitoring: Clone + Send {
    fn notice_relay_success(&mut self) {}
    fn notice_relay_failure(&mut self) {}
}

pub trait DryRunSwitch: Clone + Send {
    fn should_dry_run_now(&self) -> bool {
        true
    }
}

#[derive(Copy, Clone)]
pub struct ObligatoryDryRun;

impl RelayingMonitoring for ObligatoryDryRun {}

impl DryRunSwitch for ObligatoryDryRun {}

#[derive(Clone)]
pub struct OptionalDryRun {
    success_counter: Arc<AtomicU32>,
}

impl OptionalDryRun {
    pub fn new() -> Self {
        Self {
            success_counter: Arc::new(AtomicU32::new(OPTIMISTIC_DRY_RUN_THRESHOLD)),
        }
    }
}

impl RelayingMonitoring for OptionalDryRun {
    fn notice_relay_success(&mut self) {
        self.success_counter.fetch_add(1, Ordering::Relaxed);
    }

    fn notice_relay_failure(&mut self) {
        warn!("Relay failed, turning on dry run");
        self.success_counter.store(0, Ordering::Relaxed);
    }
}

impl DryRunSwitch for OptionalDryRun {
    fn should_dry_run_now(&self) -> bool {
        self.success_counter.load(Ordering::Relaxed) < OPTIMISTIC_DRY_RUN_THRESHOLD
    }
}
