use std::str::FromStr;

use alloy_primitives::{Address, BlockHash, Bytes, TxHash, U256};
use alloy_provider::{network::AnyNetwork, Provider};
use alloy_transport::BoxTransport;
use anyhow::{anyhow, bail, Result};
use serde::Serialize;
use shielder_account::{
    call_data::{WithdrawCallType, WithdrawExtra},
    ShielderAction, Token,
};
use shielder_contract::{
    call_type::DryRun, events::get_event, merkle_path::get_current_merkle_path,
    ShielderContract::Withdraw,
};
use shielder_relayer::{
    QuoteFeeQuery, QuoteFeeResponse, RelayCalldata, RelayQuery, RelayResponse,
    SimpleServiceResponse,
};
use shielder_setup::{protocol_fee::compute_protocol_fee_from_net, version::contract_version};
use tokio::time::sleep;
use tracing::{debug, info};

use crate::{
    app_state::{AppState, RelayerRpcUrl},
    shielder_ops::{
        get_mac_salt,
        pk::{get_proving_equipment, CircuitType},
    },
};

pub async fn withdraw(
    app_state: &mut AppState,
    amount: u128,
    to: Address,
    token: Token,
    pocket_money: u128,
    memo: Vec<u8>,
) -> Result<()> {
    app_state.relayer_rpc_url.check_connection().await?;

    let pocket_money = U256::from(pocket_money);
    let memo = Bytes::from(memo);
    let quoted_fee = get_relayer_total_fee(app_state, token, pocket_money).await?;

    let protocol_fee_bps = if let Some(protocol_fee_bps) = app_state.protocol_fees.withdraw_fee {
        protocol_fee_bps
    } else {
        let shielder_user = app_state.create_shielder_user();
        let protocol_fee_bps = shielder_user.protocol_withdraw_fee_bps::<DryRun>().await?;
        app_state.protocol_fees.withdraw_fee = Some(protocol_fee_bps);
        protocol_fee_bps
    };

    let mut amount = U256::from(amount) + quoted_fee.fee_details.total_cost_fee_token;
    let protocol_fee = compute_protocol_fee_from_net(U256::from(amount), protocol_fee_bps);

    amount += protocol_fee;

    let shielded_amount = app_state.accounts[&token.address()].shielded_amount;

    if amount > shielded_amount {
        bail!("Not enough funds to withdraw");
    }

    let relayer_response = reqwest::Client::new()
        .post(app_state.relayer_rpc_url.relay_url())
        .json(
            &prepare_relayer_query(
                app_state,
                amount,
                to,
                token,
                quoted_fee,
                pocket_money,
                protocol_fee,
                memo,
            )
            .await?,
        )
        .send()
        .await?;

    debug!("Relayer response: {relayer_response:?}");
    if !relayer_response.status().is_success() {
        bail!(
            "Relayer failed to process the request: {:?}",
            relayer_response.status()
        );
    }
    let tx_hash = relayer_response.json::<RelayResponse>().await?.tx_hash;

    let provider = app_state.create_simple_provider().await?;
    let block_hash = get_block_hash(&provider, tx_hash).await?;

    let withdraw_event = get_event::<Withdraw>(&provider, tx_hash, block_hash).await?;
    debug!("Withdraw event: {withdraw_event:?}");

    app_state
        .accounts
        .get_mut(&token.address())
        .unwrap()
        .register_action(ShielderAction::withdraw(
            amount,
            withdraw_event.newNoteIndex,
            tx_hash,
            to,
            token,
            protocol_fee,
        ));
    info!("Withdrawn {amount} tokens");
    Ok(())
}

async fn get_block_hash(
    provider: &impl Provider<BoxTransport, AnyNetwork>,
    tx_hash: TxHash,
) -> Result<BlockHash> {
    for _ in 0..5 {
        if let Some(receipt) = provider.get_transaction_receipt(tx_hash).await? {
            if let Some(block_hash) = receipt.block_hash {
                return Ok(block_hash);
            }
            return Err(anyhow!("Transaction not included in any block"));
        }
        sleep(std::time::Duration::from_secs(1)).await;
    }
    bail!("Couldn't fetch transaction receipt")
}

async fn get_relayer_total_fee(
    app_state: &mut AppState,
    token: Token,
    pocket_money: U256,
) -> Result<QuoteFeeResponse> {
    let relayer_response = reqwest::Client::new()
        .post(app_state.relayer_rpc_url.fees_url())
        .json(&QuoteFeeQuery {
            fee_token: token,
            pocket_money,
        })
        .send()
        .await?;

    if !relayer_response.status().is_success() {
        bail!(
            "Relayer failed to quote fees: {:?}",
            relayer_response.status()
        );
    }
    let quoted_fees = relayer_response.json::<QuoteFeeResponse>().await?;
    Ok(quoted_fees)
}

async fn get_relayer_address(relayer_rpc_url: &RelayerRpcUrl) -> Result<Address> {
    let relayer_response = reqwest::Client::new()
        .get(relayer_rpc_url.fee_address_url())
        .send()
        .await?;

    if !relayer_response.status().is_success() {
        bail!(
            "Failed to get relayer fee address: {:?}",
            relayer_response.status()
        );
    }
    let address = relayer_response
        .json::<SimpleServiceResponse>()
        .await?
        .message;
    Ok(Address::from_str(&address)?)
}

#[allow(clippy::too_many_arguments)]
async fn prepare_relayer_query(
    app_state: &AppState,
    amount: U256,
    to: Address,
    token: Token,
    quoted_fee: QuoteFeeResponse,
    pocket_money: U256,
    protocol_fee: U256,
    memo: Bytes,
) -> Result<impl Serialize> {
    let (params, pk) = get_proving_equipment(CircuitType::Withdraw)?;
    let leaf_index = app_state.accounts[&token.address()]
        .current_leaf_index()
        .expect("Deposit mustn't be the first action");
    let (merkle_root, merkle_path) =
        get_current_merkle_path(leaf_index, &app_state.create_shielder_user()).await?;

    let chain_id = app_state
        .create_simple_provider()
        .await?
        .get_chain_id()
        .await?;

    let calldata = app_state.accounts[&token.address()].prepare_call::<WithdrawCallType>(
        &params,
        &pk,
        token,
        amount,
        &WithdrawExtra {
            merkle_path,
            to,
            relayer_address: get_relayer_address(&app_state.relayer_rpc_url).await?,
            relayer_fee: quoted_fee.fee_details.total_cost_fee_token,
            contract_version: contract_version(),
            chain_id: U256::from(chain_id),
            mac_salt: get_mac_salt(),
            pocket_money,
            protocol_fee,
            memo: memo.clone(),
        },
    );

    Ok(RelayQuery {
        calldata: RelayCalldata {
            expected_contract_version: contract_version().to_bytes(),
            amount,
            withdraw_address: to,
            merkle_root,
            nullifier_hash: calldata.old_nullifier_hash,
            new_note: calldata.new_note,
            proof: calldata.proof,
            fee_token: token,
            fee_amount: calldata.relayer_fee,
            mac_salt: calldata.mac_salt,
            mac_commitment: calldata.mac_commitment,
            pocket_money,
            memo,
        },
        quote: quoted_fee.into(),
    })
}
