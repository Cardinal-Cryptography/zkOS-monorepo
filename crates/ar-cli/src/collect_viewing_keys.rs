use std::{
    fs::File,
    io::{self, Read},
    path::PathBuf,
};

use alloy_json_rpc::RpcError;
use alloy_network::AnyNetwork;
use alloy_primitives::{Address, U256};
use alloy_provider::{Provider, ProviderBuilder};
use alloy_rpc_types::{BlockNumberOrTag, BlockTransactionsKind, TransactionTrait};
use alloy_sol_types::SolCall;
use alloy_transport::TransportErrorKind;
use hex::FromHexError;
use log::{debug, info};
use rusqlite::Connection;
use shielder_circuits::{grumpkin, GrumpkinPointAffine};
use shielder_contract::{
    ShielderContract::{newAccountERC20Call, newAccountNativeCall},
    ShielderContractError,
};
use thiserror::Error;
use type_conversions::u256_to_field;

use crate::{
    cli::Endianess,
    db::{self, ViewingKey},
};

#[derive(Debug, Error)]
#[error(transparent)]
#[non_exhaustive]
pub enum CollectKeysError {
    #[error("Error while interacting with the Shielder contract")]
    Contract(#[from] ShielderContractError),

    #[error("RPC error")]
    Rpc(#[from] RpcError<TransportErrorKind>),

    #[error("Hex decoding error")]
    HexError(#[from] FromHexError),

    #[error("Error reading AR private key file")]
    ARKeyRead(#[from] std::io::Error),

    #[error("Error converting from a little-endian byte representation to grumpkin::Fr")]
    NotAGrumpkinBaseFieldElement,

    #[error("Error while persisting data")]
    Db(#[from] rusqlite::Error),
}

/// Goes back in transaction history and collects all viewing keys
/// - look for new_account txs
/// - read c1,c2
/// - decrypt message  => k (viewing key)
/// - record k
pub async fn run(
    rpc_url: &str,
    shielder_address: &Address,
    private_key_file: &PathBuf,
    endianess: Endianess,
    from_block: u64,
    connection: Connection,
    redact_sensitive_data: bool,
) -> Result<(), CollectKeysError> {
    let provider = ProviderBuilder::new()
        .network::<AnyNetwork>()
        .on_builtin(rpc_url)
        .await?;

    let last_finalized_block_number = provider.get_block_number().await?;

    let bytes = match endianess {
        Endianess::LitteEndian => private_key_bytes(private_key_file)?,
        Endianess::BigEndian => {
            let mut bytes = private_key_bytes(private_key_file)?;
            bytes.reverse();
            bytes
        }
    };

    let private_key = grumpkin::Fr::from_bytes(&bytes)
        .into_option()
        .ok_or(CollectKeysError::NotAGrumpkinBaseFieldElement)?;

    db::create_viewing_keys_table(&connection)?;
    // TODO: checkpoint tx blocks

    for block_number in from_block..=last_finalized_block_number {
        if let Some(block) = provider
            .get_block_by_number(
                BlockNumberOrTag::Number(block_number),
                BlockTransactionsKind::Full,
            )
            .await?
        {
            if let Some(txs) = block.transactions.as_transactions() {
                for tx in txs {
                    if tx.to().eq(&Some(*shielder_address)) {
                        if let Ok(newAccountNativeCall {
                            symKeyEncryptionC1X,
                            symKeyEncryptionC1Y,
                            symKeyEncryptionC2X,
                            symKeyEncryptionC2Y,
                            ..
                        }) = newAccountNativeCall::abi_decode(tx.input(), false)
                        {
                            debug!("Processing newAccountNative transaction {tx:?}");

                            decode_and_persist(
                                &connection,
                                symKeyEncryptionC1X,
                                symKeyEncryptionC1Y,
                                symKeyEncryptionC2X,
                                symKeyEncryptionC2Y,
                                private_key,
                                redact_sensitive_data,
                            )?;
                        }

                        if let Ok(newAccountERC20Call {
                            symKeyEncryptionC1X,
                            symKeyEncryptionC1Y,
                            symKeyEncryptionC2X,
                            symKeyEncryptionC2Y,
                            ..
                        }) = newAccountERC20Call::abi_decode(tx.input(), false)
                        {
                            debug!("Processing newAccountERC20 transaction {tx:?}");
                            decode_and_persist(
                                &connection,
                                symKeyEncryptionC1X,
                                symKeyEncryptionC1Y,
                                symKeyEncryptionC2X,
                                symKeyEncryptionC2Y,
                                private_key,
                                redact_sensitive_data,
                            )?;
                        }
                    }
                }
            }
        }
    }

    info!("Done");

    Ok(())
}

fn decode_and_persist(
    connection: &Connection,
    c1x: U256,
    c1y: U256,
    c2x: U256,
    c2y: U256,
    private_key: grumpkin::Fr,
    redact_sensitive_data: bool,
) -> Result<(), CollectKeysError> {
    let ciphertext1 = GrumpkinPointAffine::new(u256_to_field(c1x), u256_to_field(c1y));
    let ciphertext2 = GrumpkinPointAffine::new(u256_to_field(c2x), u256_to_field(c2y));

    let GrumpkinPointAffine { x, .. } =
        shielder_circuits::decrypt(ciphertext1.into(), ciphertext2.into(), private_key).into();

    debug!(
        "Viewing key decoding {}",
        logging::redact_private_key(&x, redact_sensitive_data)
    );

    db::upsert_viewing_key(
        connection,
        ViewingKey {
            viewing_key: x.to_bytes().to_vec(),
        },
    )?;

    Ok(())
}

fn private_key_bytes(file: &PathBuf) -> Result<[u8; 32], io::Error> {
    let mut file = File::open(file)?;
    let mut buffer = [0u8; 32];
    file.read_exact(&mut buffer)?;

    let mut maybe_one_more_byte = [0u8; 1];
    if file.read(&mut maybe_one_more_byte)? != 0 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Private key file contains more than 32 bytes!",
        ));
    }

    Ok(buffer)
}

mod logging {

    use rand::{seq::SliceRandom, thread_rng};
    use shielder_circuits::Fr;
    use type_conversions::Endianess;

    /// replaces half of the content with *
    pub fn redacted(input: &str, redact: bool) -> String {
        if input.is_empty() || !redact {
            return input.to_string();
        }

        let mut chars: Vec<char> = input.chars().collect();
        let total_chars = chars.len();

        // redact half of the content
        let chars_to_redact = (total_chars as f32 * 0.5).ceil() as usize;

        let mut rng = thread_rng();
        let mut indices: Vec<usize> = (0..total_chars).collect();
        indices.shuffle(&mut rng);

        for &idx in indices.iter().take(chars_to_redact) {
            chars[idx] = '*';
        }

        chars.into_iter().collect()
    }

    pub fn redact_private_key(private_key: &Fr, redact: bool) -> String {
        let hex_encoding = hex::encode(private_key.to_bytes_le());
        redacted(&hex_encoding, redact)
    }
}
