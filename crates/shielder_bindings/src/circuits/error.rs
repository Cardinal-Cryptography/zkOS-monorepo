use alloc::{format, string::String};

#[cfg(feature = "build-wasm")]
use wasm_bindgen::JsValue;

#[cfg_attr(feature = "build-uniffi", derive(uniffi::Error))]
#[derive(Debug, thiserror::Error)]
pub enum VerificationError {
    #[error("Verification failed: {message}")]
    VerificationFailed { message: String },
}

#[cfg(feature = "build-wasm")]
impl From<VerificationError> for JsValue {
    fn from(error: VerificationError) -> Self {
        JsValue::from_str(&format!("{}", error))
    }
}

impl From<halo2_proofs::plonk::Error> for VerificationError {
    fn from(error: halo2_proofs::plonk::Error) -> Self {
        VerificationError::VerificationFailed {
            message: format!("{:?}", error),
        }
    }
}
