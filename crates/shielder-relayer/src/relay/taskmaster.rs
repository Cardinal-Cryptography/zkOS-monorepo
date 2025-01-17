use alloy_provider::Provider;
use anyhow::Result;
use async_channel::{Receiver as MPMCReceiver, Sender as MPMCSender};
use shielder_contract::{
    alloy_primitives::{Address, TxHash},
    call_type::{DryRun, Submit},
    ShielderContract::withdrawNativeCall,
    ShielderContractError, ShielderUser,
};
use tokio::sync::{
    mpsc::Sender as MPSCSender,
    oneshot,
    oneshot::{Receiver as OneshotReceiver, Sender as OneshotSender},
};
use tracing::{error, info};

use crate::{
    config::DryRunning,
    relay::{
        monitoring::{DryRunSwitch, ObligatoryDryRun, OptionalDryRun, RelayingMonitoring},
        request_trace::RequestTrace,
        TASK_QUEUE_SIZE,
    },
};

pub enum TaskResult {
    DryRunFailed(ShielderContractError),
    RelayFailed(ShielderContractError),
    Ok(TxHash),
}

pub struct Task {
    report: OneshotSender<(RequestTrace, TaskResult)>,
    payload: withdrawNativeCall,
    request_trace: RequestTrace,
}

#[derive(Clone)]
pub struct Taskmaster {
    task_sender: MPMCSender<Task>,
}

impl Taskmaster {
    pub fn new(
        shielder_users: Vec<ShielderUser<impl Provider + Clone + 'static>>,
        dry_running: DryRunning,
        recharge_reporter: MPSCSender<Address>,
    ) -> Self {
        let (task_sender, task_receiver) = async_channel::bounded(TASK_QUEUE_SIZE);

        match dry_running {
            DryRunning::Always => {
                info!("Dry running is turned on for all calls");
                Self::spawn_workers(
                    shielder_users,
                    task_receiver,
                    ObligatoryDryRun {},
                    recharge_reporter,
                );
            }
            DryRunning::Optimistic => {
                info!("Dry running is optimistically disabled.");
                Self::spawn_workers(
                    shielder_users,
                    task_receiver,
                    OptionalDryRun::new(),
                    recharge_reporter,
                );
            }
        }

        Self { task_sender }
    }

    fn spawn_workers(
        shielder_users: Vec<ShielderUser<impl Provider + Clone + 'static>>,
        task_receiver: MPMCReceiver<Task>,
        dry_run_manager: impl RelayingMonitoring + DryRunSwitch + 'static,
        recharge_reporter: MPSCSender<Address>,
    ) {
        for shielder_user in shielder_users {
            tokio::spawn(relay_worker(
                task_receiver.clone(),
                shielder_user,
                dry_run_manager.clone(),
                recharge_reporter.clone(),
            ));
        }
    }

    pub async fn register_new_task(
        &self,
        payload: withdrawNativeCall,
        mut request_trace: RequestTrace,
    ) -> Result<OneshotReceiver<(RequestTrace, TaskResult)>> {
        let (report_sender, report_receiver) = oneshot::channel();

        request_trace.record("queued for relay");
        let task = Task {
            report: report_sender,
            payload,
            request_trace,
        };
        self.task_sender
            .send(task)
            .await
            .map_err(|_| anyhow::anyhow!("Failed to send task to relay"))?;

        Ok(report_receiver)
    }
}

async fn relay_worker(
    requests: MPMCReceiver<Task>,
    shielder_user: ShielderUser<impl Provider + Clone>,
    mut dry_run_manager: impl RelayingMonitoring + DryRunSwitch,
    recharge_reporter: MPSCSender<Address>,
) {
    let worker_address = shielder_user.address();
    while let Ok(task) = requests.recv().await {
        let mut request_trace = task.request_trace;
        request_trace.record("received by worker");
        request_trace.set_relayer_address(worker_address);

        if dry_run_manager.should_dry_run_now() {
            let dry_run_result = shielder_user
                .withdraw_native::<DryRun>(task.payload.clone())
                .await;
            request_trace.record("dry run completed");

            if let Err(err) = dry_run_result {
                let _ = task
                    .report
                    .send((request_trace, TaskResult::DryRunFailed(err)));
                continue;
            }
        }

        let submit_result = shielder_user.withdraw_native::<Submit>(task.payload).await;
        request_trace.record("relay completed");

        match submit_result {
            Ok(tx_hash) => {
                let _ = task.report.send((request_trace, TaskResult::Ok(tx_hash)));
                dry_run_manager.notice_relay_success();
            }
            Err(err) => {
                let _ = task
                    .report
                    .send((request_trace, TaskResult::RelayFailed(err)));
                dry_run_manager.notice_relay_failure();
            }
        };
        if let Err(err) = recharge_reporter.send(worker_address).await {
            error!(
                relay_worker = ?worker_address,
                "Failed to report relay to recharge worker: {err}"
            );
        }
    }

    error!("Relay worker thread stopped working - channel closed. Corresponding address: {worker_address}");
}
