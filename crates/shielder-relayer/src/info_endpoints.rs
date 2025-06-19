use axum::{extract::State, response::IntoResponse, Json};
use shielder_relayer::TokenKind;

use crate::AppState;

/// Get the address to which relay fees should be sent.
#[utoipa::path(
    get,
    path = "/fee_address",
    responses((status = 200, body = String))
)]
pub async fn fee_address(state: State<AppState>) -> impl IntoResponse {
    Json(state.signer_info.fee_destination_address.to_string())
}

/// Get information about the supported tokens.
#[utoipa::path(
    get,
    path = "/supported_tokens",
    responses((status = 200, body = [TokenKind]))
)]
pub async fn supported_tokens(state: State<AppState>) -> impl IntoResponse {
    Json(
        state
            .token_config
            .iter()
            .map(|t| t.kind)
            .collect::<Vec<_>>(),
    )
}

/// Get upper limit for pocket money.
#[utoipa::path(get, path = "/max_pocket_money", responses((status = 200, body = String)))]
pub async fn max_pocket_money(state: State<AppState>) -> impl IntoResponse {
    Json(state.max_pocket_money.to_string())
}
