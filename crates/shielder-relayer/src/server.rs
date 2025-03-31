use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

use crate::SimpleServiceResponse;

pub fn success(msg: &str) -> Response {
    (StatusCode::OK, jsonize_str(msg)).into_response()
}

pub fn success_response<R: Serialize>(response: R) -> Response {
    (StatusCode::OK, Json(response)).into_response()
}

pub fn server_error(msg: &str) -> Response {
    let code = StatusCode::INTERNAL_SERVER_ERROR;
    (code, jsonize_str(msg)).into_response()
}

pub fn bad_request(msg: &str) -> Response {
    (StatusCode::BAD_REQUEST, jsonize_str(msg)).into_response()
}

pub fn temporary_failure(msg: &str) -> Response {
    let code = StatusCode::SERVICE_UNAVAILABLE;
    (code, jsonize_str(msg)).into_response()
}

fn jsonize_str(msg: &str) -> Json<SimpleServiceResponse> {
    Json(SimpleServiceResponse {
        message: msg.into(),
    })
}
