use crate::config::ServerConfig;

impl ServerConfig {
    pub fn print_safe_config(&self) -> String {
        format!(
            r"
ServerConfig {{
    logging_format: {:#?},
    network: {:#?},
    operations: {:#?},
    chain:
        ChainConfig {{
            node_rpc_url: {:#?},
            shielder_contract_address: {:#?},
            fee_destination_key: [REDACTED],
            signing_keys: [{} key(s) REDACTED],
            total_fee: {:#?},
            relay_gas: {:#?},
            native_token: {:#?},
        }},
}}",
            self.logging_format,
            self.network,
            self.operations,
            self.chain.node_rpc_url,
            self.chain.shielder_contract_address,
            self.chain.signing_keys.len(),
            self.chain.total_fee,
            self.chain.relay_gas,
            self.chain.native_token,
        )
    }
}
