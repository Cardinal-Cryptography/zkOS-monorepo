use alloy_network::AnyNetwork;
use alloy_primitives::{Address, Bytes};
use alloy_provider::Provider;
use alloy_rpc_types::Filter;
use alloy_sol_types::SolEvent;
use alloy_transport::BoxTransport;
use anyhow::Result;
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{Deposit, NewAccount, Withdraw},
};

use crate::utils::get_contract_deployment_block_num;

const BATCH_LENGTH: usize = 10000;


pub struct Referral {
    pub block_number: u64,
    pub transaction_hash: [u8; 32],
    pub memo: Bytes,
}

pub async fn scan_blocks(
    rpc_url: &str,
    contract_address: &Address,
    start_block: Option<u64>,
    stop_block: Option<u64>,
) -> Result<Vec<Referral>> {
    let provider = create_simple_provider(rpc_url).await?;
    let deployment_block_num =
        get_contract_deployment_block_num(&provider, contract_address).await?;

    let current_num = provider.get_block_number().await?;
    println!("Contract {contract_address} was deployed at block number: {deployment_block_num}");
    println!("Current block number: {current_num}");
    let start_block = match start_block {
        Some(num) => {
            if num < deployment_block_num {
                return Err(anyhow::anyhow!(
                    "Start block {} is before contract deployment at block {}",
                    num,
                    deployment_block_num
                ));
            }
            num
        }
        None => deployment_block_num,
    };
    let stop_block = match stop_block {
        Some(num) => {
            if num > current_num {
                return Err(anyhow::anyhow!(
                    "Stop block {} is after current block {}",
                    num,
                    current_num
                ));
            }
            num
        }
        None => current_num,
    };

    find_referrals(&provider, contract_address, start_block, stop_block).await
}

async fn find_referrals(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
    contract_address: &Address,
    start_block: u64,
    stop_block: u64,
) -> Result<Vec<Referral>> {
    let mut referrals = Vec::new();
    let mut next_block_to_process = start_block;
    while next_block_to_process <= stop_block {
        let end_block = (next_block_to_process + BATCH_LENGTH as u64).min(stop_block);
        println!(
            "Processing blocks from {} to {}",
            next_block_to_process, end_block
        );
        let filter = Filter::new()
            .address(*contract_address)
            .from_block(next_block_to_process)
            .to_block(end_block);

        let raw_logs = provider.get_logs(&filter).await?;

        for log in raw_logs {
            let tx_hash = log
                .transaction_hash
                .ok_or(anyhow::anyhow!("Missing transaction hash"))?
                .0;
            let block_number = log
                .block_number
                .ok_or(anyhow::anyhow!("Missing block number"))?;
            let memo = match log.topic0() {
                Some(&NewAccount::SIGNATURE_HASH) => {
                    let new_account = NewAccount::decode_log_data(log.data(), true)?;
                    Some(new_account.memo)
                }
                Some(&Deposit::SIGNATURE_HASH) => {
                    let deposit = Deposit::decode_log_data(log.data(), true)?;
                    Some(deposit.memo)
                }
                Some(&Withdraw::SIGNATURE_HASH) => {
                    let withdraw = Withdraw::decode_log_data(log.data(), true)?;
                    Some(withdraw.memo)
                }
                _ => None,
            };
            if let Some(memo) = memo {
                referrals.push(Referral {
                    block_number,
                    transaction_hash: tx_hash,
                    memo,
                });
            }
        }
        next_block_to_process = end_block + 1;
    }

    Ok(referrals)
}
