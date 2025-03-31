use std::str::FromStr;

use alloy_primitives::{Address, BlockHash, TxHash, U256};
use alloy_provider::Provider;
use anyhow::{anyhow, bail, Result};
use serde::Serialize;
use shielder_account::{
    call_data::{WithdrawCallType, WithdrawExtra},
    ShielderAction, Token,
};
use shielder_contract::{
    events::get_event, merkle_path::get_current_merkle_path, ShielderContract::Withdraw,
};
use shielder_relayer::{
    QuoteFeeQuery, QuoteFeeResponse, RelayCalldata, RelayQuery, RelayQuote, RelayResponse,
};
use shielder_setup::version::contract_version;
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
) -> Result<()> {
    app_state.relayer_rpc_url.check_connection().await?;

    let pocket_money = U256::from(pocket_money);
    let quoted_fee = get_relayer_total_fee(app_state, token, pocket_money).await?;
    let amount = U256::from(amount) + quoted_fee.total_fee;
    let shielded_amount = app_state.accounts[&token.address()].shielded_amount;

    if amount > shielded_amount {
        bail!("Not enough funds to withdraw");
    }

    let relayer_response = reqwest::Client::new()
        .post(app_state.relayer_rpc_url.relay_url())
        .json(&prepare_relayer_query(app_state, amount, to, token, quoted_fee, pocket_money).await?)
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
        ));
    info!("Withdrawn {amount} tokens");
    Ok(())
}

async fn get_block_hash(provider: &impl Provider, tx_hash: TxHash) -> Result<BlockHash> {
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
    let address = relayer_response.text().await?;
    Ok(Address::from_str(&address)?)
}

async fn prepare_relayer_query(
    app_state: &AppState,
    amount: U256,
    to: Address,
    token: Token,
    quoted_fee: QuoteFeeResponse,
    pocket_money: U256,
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
            relayer_fee: quoted_fee.total_fee,
            contract_version: contract_version(),
            chain_id: U256::from(chain_id),
            mac_salt: get_mac_salt(),
            pocket_money,
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
        },
        quote: quoted_fee.into(),
    })
}
