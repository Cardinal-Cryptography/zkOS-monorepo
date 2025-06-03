#[derive(Clone, serde::Serialize)]
pub struct FeeResponse {
    pub native_new_account_gas: String,
    pub native_deposit_gas: String,
    pub erc20_new_account_gas: String,
    pub erc20_deposit_gas: String,
    pub gas_price_native: String,
}

/// Returns a FeeResponse with mocked values.
pub fn get_fee_values(index: usize) -> FeeResponse {
    match index % 3 {
        0 => FeeResponse {
            native_new_account_gas: "110000".to_string(),
            native_deposit_gas: "55000".to_string(),
            erc20_new_account_gas: "160000".to_string(),
            erc20_deposit_gas: "80000".to_string(),
            gas_price_native: "22000000000".to_string(), // 22 Gwei
        },
        1 => FeeResponse {
            native_new_account_gas: "95000".to_string(),
            native_deposit_gas: "48000".to_string(),
            erc20_new_account_gas: "145000".to_string(),
            erc20_deposit_gas: "72000".to_string(),
            gas_price_native: "19000000000".to_string(), // 19 Gwei
        },
        _ => FeeResponse {
            native_new_account_gas: "105000".to_string(),
            native_deposit_gas: "52000".to_string(),
            erc20_new_account_gas: "155000".to_string(),
            erc20_deposit_gas: "77000".to_string(),
            gas_price_native: "21000000000".to_string(), // 21 Gwei
        },
    }
}
