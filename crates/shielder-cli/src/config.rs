use std::path::PathBuf;

use alloy_primitives::Address;
use anyhow::Result;
use clap::{Args, Parser, Subcommand, ValueEnum};
use inquire::Password;

#[derive(Clone, Eq, PartialEq, Debug, Parser)]
pub struct CliConfig {
    /// Path to the file containing application state.
    #[clap(long, default_value = "~/.shielder-state", value_parser = parsing::parse_path)]
    pub state_file: PathBuf,

    /// Logging configuration.
    #[clap(short = 'l', value_enum, default_value = "text")]
    pub logging_format: LoggingFormat,

    /// Password for `state_file` encryption and decryption.
    ///
    /// If not provided, will be prompted.
    #[clap(long)]
    password: Option<String>,

    /// Do not prompt for a password. Use empty password instead. Only for testing.
    #[clap(long, default_value = "false")]
    no_password: bool,

    #[clap(subcommand)]
    pub command: Command,
}

impl CliConfig {
    pub fn password(&self) -> Result<String> {
        if self.no_password {
            return Ok("".to_string());
        }
        match &self.password {
            Some(password) => Ok(password.clone()),
            None => Ok(Password::new("Password (for encrypting local state):")
                .without_confirmation()
                .prompt()?),
        }
    }
}

#[derive(Clone, Eq, PartialEq, Debug, Subcommand)]
pub enum Command {
    #[clap(flatten)]
    StateWrite(StateWriteCommand),
    #[clap(flatten)]
    StateRead(StateReadCommand),
    #[clap(flatten)]
    ContractInteraction(ContractInteractionCommand),
}

#[derive(Clone, Eq, PartialEq, Debug, Subcommand)]
pub enum StateWriteCommand {
    /// Initialize local state using ETH private key for both signing on-chain transactions and
    /// as the shielded account seed.
    Initialize {
        /// Private key of the depositor account.
        private_key: String,
    },
    /// Set RPC address of the node that we will be connecting to.
    NodeUrl {
        /// RPC endpoint address of the node to connect to.
        node: String,
    },
    /// Set address of the Shielder contract.
    ContractAddress {
        /// Address of the Shielder contract.
        address: Address,
    },
    /// Set relayer URL address.
    RelayerUrl {
        /// Address of the relayer.
        url: String,
    },
    /// Recover state from the blockchain.
    RecoverState,
}

#[derive(Clone, Eq, PartialEq, Debug, Subcommand)]
pub enum StateReadCommand {
    /// Display account details.
    DisplayAccount,
    /// Display full account history.
    History,
    /// Display application configuration.
    AppConfig,
}

#[derive(Clone, Eq, PartialEq, Debug, Subcommand)]
pub enum ContractInteractionCommand {
    /// Create new shielder account.
    NewAccount(NewAccountCmd),
    /// Shield some tokens.
    Deposit(DepositCmd),
    /// Unshield some tokens.
    Withdraw(WithdrawCmd),
}

#[derive(Clone, Eq, PartialEq, Debug, Args)]
pub struct NewAccountCmd {
    /// Amount of the token to be shielded.
    pub amount: u128,
}

#[derive(Clone, Eq, PartialEq, Debug, Args)]
pub struct DepositCmd {
    /// Amount of the token to be shielded.
    pub amount: u128,
}

#[derive(Clone, Eq, PartialEq, Debug, Args)]
pub struct WithdrawCmd {
    /// Amount of the token to be shielded.
    pub amount: u128,
    /// Address to which the tokens should be sent.
    pub to: Address,
}

#[derive(Copy, Clone, Eq, PartialEq, Debug, Default, ValueEnum)]
pub enum LoggingFormat {
    #[default]
    Text,
    Json,
}

mod parsing {
    use std::{path::PathBuf, str::FromStr};

    use anyhow::{anyhow, Result};

    pub fn parse_path(path: &str) -> Result<PathBuf> {
        let expanded_path =
            shellexpand::full(path).map_err(|e| anyhow!("Failed to expand path: {e:?}"))?;
        PathBuf::from_str(expanded_path.as_ref())
            .map_err(|e| anyhow!("Failed to interpret path: {e:?}"))
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn verify_cli() {
        use clap::CommandFactory;
        crate::config::CliConfig::command().debug_assert()
    }
}
