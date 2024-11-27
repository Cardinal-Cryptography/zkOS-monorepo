use std::time::{Duration, Instant};

use shielder_relayer::RelayQuery;
use shielder_rust_sdk::{
    alloy_primitives::{Address, TxHash, U256},
    contract::ShielderContractError,
};
use tracing::{error, info};

use crate::metrics::{WITHDRAW_DRY_RUN_FAILURE, WITHDRAW_FAILURE, WITHDRAW_SUCCESS};

type Measurement = (String, Duration);

pub struct RequestTrace {
    created_note: U256,

    measurements: Vec<Measurement>,
    last_timestamp: Instant,
    current_state: &'static str,

    relayer_address: Option<Address>,
    status: Option<&'static str>,
    tx_hash: Option<TxHash>,
}

impl RequestTrace {
    pub fn new(relay_query: &RelayQuery) -> Self {
        Self {
            created_note: relay_query.new_note,
            measurements: Vec::new(),
            last_timestamp: Instant::now(),
            current_state: "created",
            relayer_address: None,
            status: None,
            tx_hash: None,
        }
    }

    pub fn record(&mut self, new_state: &'static str) {
        if let Some(status) = self.status {
            error!("RequestTrace is already finished with status: {}", status);
        }

        let duration = self.last_timestamp.elapsed();
        self.measurements
            .push((format!("[{} -> {new_state}]", self.current_state), duration));
        self.current_state = new_state;
        self.last_timestamp = Instant::now();
    }

    pub fn set_relayer_address(&mut self, relayer: Address) {
        self.relayer_address = Some(relayer);
    }

    pub fn record_success(&mut self, tx_hash: TxHash) {
        metrics::counter!(WITHDRAW_SUCCESS).increment(1);
        self.tx_hash = Some(tx_hash);
        self.finish("✅ SUCCESS");
    }

    pub fn record_failure(&mut self, err: ShielderContractError) {
        metrics::counter!(WITHDRAW_FAILURE).increment(1);
        error!("Relay failed: {err}");
        self.finish("❌ FAILURE");
    }

    pub fn record_dry_run_failure(&mut self, err: ShielderContractError) {
        metrics::counter!(WITHDRAW_DRY_RUN_FAILURE).increment(1);
        info!("Relay dry-run failed: {err}");
        self.finish("❌ DRY-RUN FAILURE");
    }

    fn finish(&mut self, status: &'static str) {
        self.record("finished");
        self.status = Some(status);
    }
}

impl Drop for RequestTrace {
    fn drop(&mut self) {
        let tx_hash = match self.tx_hash {
            Some(tx_hash) => tx_hash.to_string(),
            None => "No tx hash set".to_string(),
        };
        let relayer_address = match self.relayer_address {
            Some(address) => address.to_string(),
            None => "No relayer address set".to_string(),
        };
        let measurements = self
            .measurements
            .iter()
            .map(|(state, duration)| format!("{state}: {duration:?}"))
            .collect::<Vec<_>>();

        info!(
            status = self.status.unwrap_or("in progress"),
            created_note = %self.created_note,
            tx_hash = tx_hash,
            relayer_address = %relayer_address,
            measurements = ?measurements,
            "Request trace",
        );
    }
}
