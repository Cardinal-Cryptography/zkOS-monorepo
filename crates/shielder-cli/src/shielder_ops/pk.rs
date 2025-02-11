use std::{fs, path::PathBuf, str::FromStr};

use anyhow::Result;
use powers_of_tau::{get_ptau_file_path, read as read_setup_parameters, Format};
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    deposit::DepositCircuit,
    generate_keys_with_min_k,
    marshall::{marshall_params, marshall_pk, unmarshall_params, unmarshall_pk},
    new_account::NewAccountCircuit,
    withdraw::WithdrawCircuit,
    Params as _, F, MAX_K,
};
use tracing::debug;

const NEW_ACCOUNT_PK_FILE: &str = "~/shielder-cli/new_account_pk";
const DEPOSIT_PK_FILE: &str = "~/shielder-cli/deposit_pk";
const WITHDRAW_PK_FILE: &str = "~/shielder-cli/withdraw_pk";
const PROVING_PARAMS_FILE: &str = "~/shielder-cli/proving_params";

#[derive(Copy, Clone, Debug)]
pub enum CircuitType {
    NewAccount,
    Deposit,
    Withdraw,
}

impl CircuitType {
    pub fn filepath(self) -> Result<PathBuf> {
        expand_path(match self {
            CircuitType::NewAccount => NEW_ACCOUNT_PK_FILE,
            CircuitType::Deposit => DEPOSIT_PK_FILE,
            CircuitType::Withdraw => WITHDRAW_PK_FILE,
        })
    }

    pub fn unmarshall_pk(self, bytes: &[u8]) -> Result<(u32, ProvingKey)> {
        match self {
            CircuitType::NewAccount => unmarshall_pk::<NewAccountCircuit<F>>(bytes),
            CircuitType::Deposit => unmarshall_pk::<DepositCircuit<F>>(bytes),
            CircuitType::Withdraw => unmarshall_pk::<WithdrawCircuit<F>>(bytes),
        }
        .map_err(|_| anyhow::Error::msg("Failed to unmarshall proving key"))
    }

    pub fn generate_keys(self, full_params: Params) -> Result<(Params, u32, ProvingKey)> {
        let (params, k, pk, _) = match self {
            CircuitType::NewAccount => {
                generate_keys_with_min_k::<NewAccountCircuit<_>>(full_params)?
            }
            CircuitType::Deposit => generate_keys_with_min_k::<DepositCircuit<_>>(full_params)?,
            CircuitType::Withdraw => generate_keys_with_min_k::<WithdrawCircuit<_>>(full_params)?,
        };
        debug!("Generated keys for {self:?} circuit with k={k}");
        Ok((params, k, pk))
    }
}

pub fn get_proving_equipment(circuit_type: CircuitType) -> Result<(Params, ProvingKey)> {
    let full_params = get_params()?;
    get_equipment(circuit_type, full_params)
}

fn get_params() -> Result<Params> {
    let file = expand_path(PROVING_PARAMS_FILE)?;

    debug!("Getting proving params from {file:?}");

    match fs::read(file.clone()).map(|bytes| unmarshall_params(&bytes)) {
        Ok(Ok(full_params)) => {
            debug!("Found and decoded proving params from {file:?}");
            Ok(full_params)
        }
        _ => {
            debug!("Params not found or found corrupted, importing new ones...");

            let params = read_setup_parameters(
                get_ptau_file_path(MAX_K, Format::PerpetualPowersOfTau),
                Format::PerpetualPowersOfTau,
            )?;
            debug!("Generated new proving params");

            save_content(
                file.clone(),
                &marshall_params(&params)
                    .map_err(|_| anyhow::Error::msg("Failed to marshall params"))?,
            )?;
            debug!("Saved proving params to {file:?}");

            Ok(params)
        }
    }
}

fn get_equipment(
    circuit_type: CircuitType,
    mut full_params: Params,
) -> Result<(Params, ProvingKey)> {
    let file = circuit_type.filepath()?;
    debug!("Getting proving key from {file:?} for {circuit_type:?} circuit");

    match fs::read(file.clone()).map(|bytes| circuit_type.unmarshall_pk(&bytes)) {
        Ok(Ok((k, pk))) => {
            debug!("Found and decoded proving key from {file:?}");
            let old_k = full_params.k();
            full_params.downsize(k);
            debug!("Downsized proving params from {old_k} to {k}");
            Ok((full_params, pk))
        }
        _ => {
            debug!("Proving key not found or found corrupted, generating new one...");

            let (params, k, pk) = circuit_type.generate_keys(full_params)?;
            debug!("Generated new proving key");

            save_content(
                file.clone(),
                &marshall_pk(k, &pk)
                    .map_err(|_| anyhow::Error::msg("Failed to marshall proving key"))?,
            )?;
            debug!("Saved proving key to {file:?}");

            Ok((params, pk))
        }
    }
}

fn expand_path(path: &str) -> Result<PathBuf> {
    Ok(PathBuf::from_str(shellexpand::full(path)?.as_ref())?)
}

fn save_content(path: PathBuf, content: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content).map_err(Into::into)
}
