use anyhow::Result;
use clap::Parser;
use shielder_rust_sdk::native_token::ONE_TZERO;

mod actor;
mod config;
mod party;
mod setup;
mod util;

const INITIAL_BALANCE: u128 = 2 * ONE_TZERO;
const SHIELDED_BALANCE: u128 = 15 * (ONE_TZERO / 10);
const WITHDRAW_AMOUNT: u128 = ONE_TZERO;

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    let config = config::Config::parse();
    let actors = setup::setup_world(&config).await?;
    party::enter_pandemonium(&config, actors).await?;
    Ok(())
}
