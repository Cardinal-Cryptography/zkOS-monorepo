use std::sync::Mutex;

use once_cell::sync::Lazy;
use serde_json::Value;

pub type JsonFnPointer = fn(Value) -> Value;

/// A simple struct to hold info about an "exported" function.
#[derive(Debug, Clone)]
pub struct JsonizedFunction {
    /// The function name as a string.
    pub name: &'static str,
    /// Pointer to the bridging function.
    pub func: JsonFnPointer,
}

/// A global registry of exported functions.
///
/// By using `Lazy<Mutex<...>>`, we can push to this vector at compile time
/// (technically, it's “init-time” for each static), and read it later.
pub static EXPORTED_FUNCTIONS: Lazy<Mutex<Vec<JsonizedFunction>>> =
    Lazy::new(|| Mutex::new(Vec::new()));
