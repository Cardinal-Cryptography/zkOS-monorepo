use axum::{
    http::StatusCode,
    response::{IntoResponse, Response as AxumResponse},
};
use shielder_prover_common::vsock::VsockError;
use tokio::task::JoinError;
use tracing::error;

#[derive(thiserror::Error, Debug)]
pub enum ShielderProverServerError {
    #[error("Internal I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Task pool error: {0}")]
    TaskPool(#[from] tokio_task_pool::Error),

    #[error("Join handle error: {0}")]
    JoinHandleError(#[from] JoinError),

    #[error("Proving Server error: {0}")]
    ProvingServerError(#[from] VsockError),
}

impl IntoResponse for ShielderProverServerError {
    fn into_response(self) -> AxumResponse {
        let (status, error_message) = match &self {
            ShielderProverServerError::Io(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Internal I/O error: {:?}", e),
            ),
            ShielderProverServerError::TaskPool(e) => (
                StatusCode::GATEWAY_TIMEOUT,
                format!("Cannot schedule more tasks: {:?}", e),
            ),
            ShielderProverServerError::ProvingServerError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("TEE Proving Server error: {:?}", e),
            ),
            ShielderProverServerError::JoinHandleError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Servers task failed to completion : {:?}", e),
            ),
        };

        error!("Error encountered: {:?}", self);

        (status, error_message).into_response()
    }
}
