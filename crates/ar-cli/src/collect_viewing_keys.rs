use std::{
    cmp::max,
    fs::File,
    io::{self, Read},
    path::PathBuf,
};

use alloy_network::AnyNetwork;
use alloy_primitives::{Address, U256};
use alloy_provider::{Provider, ProviderBuilder};
use alloy_rpc_types::{BlockNumberOrTag, BlockTransactionsKind, TransactionTrait};
use alloy_sol_types::SolCall;
use log::{debug, info, trace};
use rusqlite::Connection;
use shielder_circuits::{grumpkin, GrumpkinPointAffine};
use shielder_contract::ShielderContract::{newAccountERC20Call, newAccountNativeCall};
use type_conversions::u256_to_field;

use crate::{
    db::{self, ViewingKey},
    error::Error,
};

const CHECKPOINT_TABLE_NAME: &str = "last_keys_block";

/// Goes back in transaction history and collects all viewing keys
/// - look for new_account txs
/// - read c1,c2
/// - decrypt message  => k (viewing key)
/// - record k
pub async fn run(
    rpc_url: &str,
    shielder_address: &Address,
    private_key_file: &PathBuf,
    from_block: u64,
    db_path: &PathBuf,
    redact_sensitive_data: bool,
) -> Result<(), Error> {
    let connection = db::init(db_path)?;

    let provider = ProviderBuilder::new()
        .network::<AnyNetwork>()
        .on_builtin(rpc_url)
        .await?;

    let last_finalized_block_number = provider.get_block_number().await?;
    info!("last finalized block number: {last_finalized_block_number}");

    let bytes = {
        let mut bytes = private_key_bytes(private_key_file)?;
        // We use big-endian encoding for the private key
        bytes.reverse();
        bytes
    };

    let private_key = grumpkin::Fr::from_bytes(&bytes)
        .into_option()
        .ok_or(Error::NotAGrumpkinBaseFieldElement)?;

    db::create_viewing_keys_table(&connection)?;
    db::create_checkpoint_table(&connection, CHECKPOINT_TABLE_NAME)?;

    let last_seen_block = db::query_checkpoint(&connection, CHECKPOINT_TABLE_NAME)?;

    info!("last seen block: {last_seen_block}");

    for block_number in max(from_block, last_seen_block)..=last_finalized_block_number {
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

        trace!("Updating last seen block: {block_number}");
        db::update_checkpoint(&connection, CHECKPOINT_TABLE_NAME, block_number)?;
    }

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
) -> Result<(), Error> {
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

    use shielder_circuits::Fr;
    use type_conversions::Endianess;

    /// replaces half of the content with *
    pub fn redacted(input: &str, redact: bool) -> String {
        if input.is_empty() || !redact {
            return input.to_string();
        }

        let mut chars: Vec<char> = input.chars().collect();
        let total_chars = chars.len();

        // redact first half of the content
        let chars_to_redact = (total_chars as f32 * 0.5).ceil() as usize;

        let indices: Vec<usize> = (0..total_chars).collect();

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
