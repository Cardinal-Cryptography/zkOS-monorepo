use std::{convert::Infallible, fmt::Debug, fs::File, io::Read};

use revm::{
    primitives::{address, Address, EVMError, ExecutionResult, Output, TxKind, U256},
    Evm, InMemoryDB,
};
use revm_primitives::{AccountInfo, Bytecode, Bytes, Log};
use thiserror::Error;

use crate::{compilation::source_to_bytecode, repo_root_dir};

/// Evm runner errors
#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
#[allow(missing_docs)]
pub enum EvmRunnerError {
    #[error("Evm transaction reverted")]
    Revert(ExecutionResult),

    #[error("Evm transaction trapped")]
    Halt(ExecutionResult),

    #[error("Account does not exist")]
    AccountDoesNotExists(Address),

    #[error("Address does not have bytecode")]
    AddressDoesNotHaveBytecode(Address),

    #[error("Evm execution error")]
    EvmExecution(#[from] EVMError<Infallible>),
}

pub struct SuccessResult {
    pub gas_used: u64,
    pub output: Vec<u8>,
    pub logs: Vec<Log>,
}

/// Evm runner.
#[derive(Debug)]
pub struct EvmRunner {
    pub db: InMemoryDB,
}

fn get_precompile_source() -> String {
    let mut source = String::new();
    let mut file = File::open(repo_root_dir().join("contracts/ArbSysMock.sol"))
        .expect("Cannot open contract source file");
    file.read_to_string(&mut source)
        .expect("Cannot read contract source file");
    source
}

impl EvmRunner {
    pub fn aleph_evm() -> Self {
        let mut db = InMemoryDB::default();

        let precompiles_bytecode = source_to_bytecode(get_precompile_source(), "ArbSysMock", true);
        db.insert_account_info(
            address!("0000000000000000000000000000000000000064"),
            AccountInfo::from_bytecode(Bytecode::new_raw(Bytes::from(precompiles_bytecode))),
        );

        Self { db }
    }

    /// Return code size of given address.
    pub fn code_size(&self, address: Address) -> Result<usize, EvmRunnerError> {
        Ok(self
            .db
            .accounts
            .get(&address)
            .ok_or(EvmRunnerError::AccountDoesNotExists(address))?
            .info
            .code
            .clone()
            .ok_or(EvmRunnerError::AddressDoesNotHaveBytecode(address))?
            .len())
    }

    /// Apply `create` transaction with given `bytecode` as creation bytecode. Return created
    /// `address`.
    pub fn create(
        &mut self,
        bytecode: Vec<u8>,
        caller: Option<Address>,
    ) -> Result<Address, EvmRunnerError> {
        let mut evm = Evm::builder()
            .with_db(&mut self.db)
            .modify_tx_env(|tx| {
                tx.caller = caller.unwrap_or(address!("0000000000000000000000000000000000000000"));
                tx.gas_limit = u64::MAX;
                tx.transact_to = TxKind::Create;
                tx.data = bytecode.into();
                tx.chain_id = Some(1);
            })
            .modify_cfg_env(|env| {
                env.limit_contract_code_size = Some(0x17700);
            }) // ~96kb
            .build();

        let result = evm.transact_commit()?;

        match result {
            ExecutionResult::Success { output, .. } => match output {
                Output::Create(_, Some(address)) => Ok(address),
                _ => unreachable!(),
            },
            ExecutionResult::Revert { .. } => Err(EvmRunnerError::Revert(result)),
            ExecutionResult::Halt { .. } => Err(EvmRunnerError::Halt(result)),
        }
    }

    /// Apply `call` transaction to given `address` with `calldata`. Return a tuple of `gas_used`
    /// and `return_data`.
    pub fn call(
        &mut self,
        address: Address,
        calldata: Vec<u8>,
        caller: Option<Address>,
        value: Option<U256>,
    ) -> Result<SuccessResult, EvmRunnerError> {
        let mut evm = Evm::builder()
            .with_db(&mut self.db)
            .modify_tx_env(|tx| {
                tx.caller = caller.unwrap_or(address!("0000000000000000000000000000000000000000"));
                tx.gas_limit = u64::MAX;
                tx.transact_to = TxKind::Call(address);
                tx.data = calldata.into();
                tx.value = U256::from(value.unwrap_or(U256::ZERO));
                tx.chain_id = Some(1);
            })
            .build();

        let result = evm.transact_commit()?;

        match result {
            ExecutionResult::Success {
                output,
                gas_used,
                logs,
                ..
            } => match output {
                Output::Call(value) => Ok(SuccessResult {
                    gas_used,
                    output: value.into(),
                    logs,
                }),
                _ => unreachable!(),
            },
            ExecutionResult::Revert { .. } => Err(EvmRunnerError::Revert(result)),
            ExecutionResult::Halt { .. } => Err(EvmRunnerError::Halt(result)),
        }
    }

    pub fn get_balance(&self, address: Address) -> Result<U256, EvmRunnerError> {
        Ok(self
            .db
            .accounts
            .get(&address)
            .ok_or(EvmRunnerError::AccountDoesNotExists(address))?
            .info
            .balance)
    }
}
