use std::str::FromStr;

use alloy_primitives::{Address, BlockHash, TxHash, U256};
use alloy_provider::Provider;
use anyhow::{anyhow, bail, Result};
use serde::Serialize;
use shielder_account::{
    call_data::{MerkleProof, Token, WithdrawCallType, WithdrawExtra},
    ShielderAction,
};
use shielder_contract::{
    events::get_event, merkle_path::get_current_merkle_path, ShielderContract::Withdraw,
};
use shielder_relayer::{FeeToken, QuoteFeeResponse, RelayQuery, RelayResponse};
use shielder_setup::version::contract_version;
use tokio::time::sleep;
use tracing::{debug, info};

use crate::{
    app_state::{AppState, RelayerRpcUrl},
    shielder_ops::pk::{get_proving_equipment, CircuitType},
};

pub async fn withdraw(app_state: &mut AppState, amount: u128, to: Address) -> Result<()> {
    app_state.relayer_rpc_url.check_connection().await?;

    let total_fee = get_relayer_total_fee(app_state).await?;
    let amount = U256::from(amount) + total_fee;

    if amount > app_state.account.shielded_amount {
        bail!("Not enough funds to withdraw");
    }

    let relayer_response = reqwest::Client::new()
        .post(app_state.relayer_rpc_url.relay_url())
        .json(&prepare_relayer_query(app_state, amount, to, total_fee).await?)
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

    app_state.account.register_action(ShielderAction::withdraw(
        amount,
        withdraw_event.newNoteIndex,
        tx_hash,
        to,
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

async fn get_relayer_total_fee(app_state: &mut AppState) -> Result<U256> {
    let relayer_response = reqwest::Client::new()
        .get(app_state.relayer_rpc_url.fees_url())
        .send()
        .await?;

    if !relayer_response.status().is_success() {
        bail!(
            "Relayer failed to quote fees: {:?}",
            relayer_response.status()
        );
    }
    let quoted_fees = relayer_response.json::<QuoteFeeResponse>().await?;
    Ok(quoted_fees.total_fee.parse()?)
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
    relayer_fee: U256,
) -> Result<impl Serialize> {
    let (params, pk) = get_proving_equipment(CircuitType::Withdraw)?;
    let leaf_index = app_state
        .account
        .current_leaf_index()
        .expect("Deposit mustn't be the first action");
    let (merkle_root, merkle_path) =
        get_current_merkle_path(leaf_index, &app_state.create_shielder_user()).await?;

    let chain_id = app_state
        .create_simple_provider()
        .await?
        .get_chain_id()
        .await?;

    let calldata = app_state.account.prepare_call::<WithdrawCallType>(
        &params,
        &pk,
        Token::Native,
        amount,
        &WithdrawExtra {
            merkle_proof: MerkleProof {
                root: merkle_root,
                path: merkle_path,
            },
            to,
            relayer_address: get_relayer_address(&app_state.relayer_rpc_url).await?,
            relayer_fee,
            contract_version: contract_version(),
            chain_id: U256::from(chain_id),
        },
    );

    Ok(RelayQuery {
        expected_contract_version: contract_version().to_bytes(),
        amount,
        withdraw_address: to,
        merkle_root,
        nullifier_hash: calldata.oldNullifierHash,
        new_note: calldata.newNote,
        proof: calldata.proof,
        fee_token: FeeToken::Native,
        fee_amount: calldata.relayerFee,
        mac_salt: calldata.macSalt,
        mac_commitment: calldata.macCommitment,
    })
}
