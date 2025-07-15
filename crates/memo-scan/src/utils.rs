use alloy_network::AnyNetwork;
use alloy_primitives::{address, Address, BlockNumber, Bytes};
use alloy_provider::Provider;
use alloy_transport::BoxTransport;
use anyhow::Result;

// This thing is guaranteed to work correctly only if the provider is an archival node.
async fn get_code_at_height(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
    address: Address,
    block_number: BlockNumber,
) -> Result<Option<Bytes>> {
    let code_bytes = provider
        .get_code_at(address)
        .block_id(block_number.into())
        .await;
    match code_bytes {
        Ok(code) => {
            if code.is_empty() {
                Ok(None)
            } else {
                Ok(Some(code))
            }
        }
        Err(e) => {
            let err_text = e.to_string();
            // Not quite 100% reliable, but defensive. If the RPC endpoint outputs some different error, we will at least fail.
            if err_text.contains("missing trie node") {
                Ok(None)
            } else {
                Err(anyhow::anyhow!("Provider error: {}", e))
            }
        }
    }
}

fn archival_test_query(chain_id: u64) -> Result<(Address, BlockNumber)> {
    match chain_id {
        42161 => Ok((address!("Fd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"), 228105)), // Arbitrum One, USDT contract
        1 => Ok((
            address!("dAC17F958D2ee523a2206206994597C13D831ec7"),
            4634748,
        )), // Ethereum, USDT contract
        8453 => Ok((
            address!("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
            2797221,
        )), // Base, USDC contract
        _ => Err(anyhow::anyhow!(
            "Unsupported chain ID for archival test query: {}",
            chain_id
        )),
    }
}

pub async fn is_archival_node(provider: &impl Provider<BoxTransport, AnyNetwork>) -> Result<bool> {
    let chain_id = provider.get_chain_id().await?;
    let (address, block_number) = archival_test_query(chain_id)?;
    let code = get_code_at_height(provider, address, block_number).await?;
    Ok(code.is_some())
}

pub async fn get_contract_deployment_block_num(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
    contract_address: &Address,
) -> Result<u64> {
    if !is_archival_node(provider).await? {
        return Err(anyhow::anyhow!(
            "Provider is not an archival node. Cannot determine contract deployment block number."
        ));
    }
    let block_number = provider.get_block_number().await?;
    println!("Current block number: {block_number}");
    let code_curr = get_code_at_height(provider, *contract_address, block_number).await?;
    if code_curr.is_none() {
        return Err(anyhow::anyhow!("Contract does not exist on chain"));
    }
    let mut lo: i64 = -1;
    let mut hi: i64 = block_number as i64;
    // binary search for the deployment block
    while hi - lo > 1 {
        let mid = (lo + hi) / 2;
        let code_mid = get_code_at_height(provider, *contract_address, mid as u64).await?;
        if code_mid.is_some() {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    Ok(hi as u64)
}
