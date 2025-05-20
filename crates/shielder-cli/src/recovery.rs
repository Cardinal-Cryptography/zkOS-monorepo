use alloy_sol_types::SolCall;
use anyhow::Result;
use shielder_account::Token;
use shielder_contract::providers::create_simple_provider;

use crate::app_state::AppState;

pub async fn recover_state(app_state: &mut AppState, token: Token) -> Result<()> {
    let shielder_user = app_state.create_shielder_user();
    app_state.ensure_account_exist(token);
    let AppState {
        accounts,
        node_rpc_url,
        ..
    } = app_state;
    let provider = create_simple_provider(node_rpc_url).await?;

    Ok(accounts[&token.address()]
        .recover(&shielder_user, &provider)
        .await?)
}
