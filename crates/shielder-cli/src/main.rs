use std::{env, io};

use anyhow::{anyhow, Result};
use clap::Parser;
use shielder_account::Token;
use shielder_setup::native_token::NATIVE_TOKEN_DECIMALS;
use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::{
    app_state::{AppState, RelayerRpcUrl},
    config::{
        CliConfig,
        Command::{ContractInteraction, StateRead, StateWrite},
        ContractInteractionCommand, DepositCmd, DepositERC20Cmd, LoggingFormat, NewAccountCmd,
        NewAccountERC20Cmd, StateReadCommand, StateWriteCommand, WithdrawCmd, WithdrawERC20Cmd,
    },
    recovery::recover_state,
    shielder_ops::{deposit, new_account, withdraw},
    state_file::{create_and_save_new_state, get_app_state, save_app_state},
};

mod app_state;
mod config;
mod recovery;
mod shielder_ops;
mod state_file;

fn init_logging(format: LoggingFormat) -> Result<()> {
    const LOG_CONFIGURATION_ENVVAR: &str = "RUST_LOG";

    let filter = EnvFilter::new(
        env::var(LOG_CONFIGURATION_ENVVAR)
            .as_deref()
            .unwrap_or("debug"),
    );

    let subscriber = tracing_subscriber::fmt()
        .with_writer(io::stdout)
        .with_target(true)
        .with_env_filter(filter);

    match format {
        LoggingFormat::Json => subscriber.json().try_init(),
        LoggingFormat::Text => subscriber.try_init(),
    }
    .map_err(|err| anyhow!(err))
}

async fn perform_state_write_action(
    app_state: &mut AppState,
    command: StateWriteCommand,
) -> Result<()> {
    match command {
        StateWriteCommand::Initialize { .. } => {
            unreachable!("State initialization should have been handled in a different context")
        }
        StateWriteCommand::NodeUrl { node } => {
            info!("Setting node address to {node}");
            app_state.node_rpc_url = node;
        }
        StateWriteCommand::ContractAddress { address } => {
            info!("Setting contract address to {address}");
            app_state.contract_address = address;
        }
        StateWriteCommand::RelayerUrl { url } => {
            let relayer_rpc_url = RelayerRpcUrl::new(url.clone());
            relayer_rpc_url.check_connection().await?;
            info!("Setting relayer url to {url}");
            app_state.relayer_rpc_url = relayer_rpc_url;
        }
        StateWriteCommand::RecoverState => {
            recover_state(app_state).await?;
        }
    };
    Ok(())
}

fn perform_state_read_action(app_state: &AppState, command: StateReadCommand) -> Result<()> {
    match command {
        StateReadCommand::DisplayAccount => {
            println!("{}", app_state.account)
        }
        StateReadCommand::History => {
            println!("{:#?}", app_state.account.history)
        }
        StateReadCommand::AppConfig => {
            println!("{}", app_state.display_app_config())
        }
    };
    Ok(())
}

async fn perform_contract_action(
    app_state: &mut AppState,
    command: ContractInteractionCommand,
) -> Result<()> {
    match command {
        ContractInteractionCommand::NewAccount(NewAccountCmd { amount }) => {
            new_account(app_state, amount, Token::Native).await
        }
        ContractInteractionCommand::NewAccountERC20(NewAccountERC20Cmd {
            amount,
            token_address,
        }) => new_account(app_state, amount, Token::ERC20(token_address)).await,

        ContractInteractionCommand::Deposit(DepositCmd { amount }) => {
            deposit(app_state, amount, Token::Native).await
        }
        ContractInteractionCommand::DepositERC20(DepositERC20Cmd {
            amount,
            token_address,
        }) => deposit(app_state, amount, Token::ERC20(token_address)).await,

        ContractInteractionCommand::Withdraw(WithdrawCmd { amount, to }) => {
            withdraw(app_state, amount, to, Token::Native, NATIVE_TOKEN_DECIMALS).await
        }
        ContractInteractionCommand::WithdrawERC20(WithdrawERC20Cmd {
            amount,
            to,
            token_address,
            decimals,
        }) => withdraw(app_state, amount, to, Token::ERC20(token_address), decimals).await,
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli_config = CliConfig::parse();
    init_logging(cli_config.logging_format)?;

    let password = cli_config.password()?;

    if let StateWrite(StateWriteCommand::Initialize { private_key }) = cli_config.command {
        create_and_save_new_state(&cli_config.state_file, &password, &private_key)?;
    } else {
        let mut app_state = get_app_state(&cli_config.state_file, &password)?;

        match cli_config.command {
            StateWrite(cmd) => {
                perform_state_write_action(&mut app_state, cmd).await?;
                save_app_state(&app_state, &cli_config.state_file, &password)?;
            }
            StateRead(cmd) => perform_state_read_action(&app_state, cmd)?,
            ContractInteraction(cmd) => {
                perform_contract_action(&mut app_state, cmd).await?;
                save_app_state(&app_state, &cli_config.state_file, &password)?;
            }
        }
    }

    Ok(())
}
