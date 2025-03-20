use std::{
    fs::File,
    io::{self, Read},
};

use alloy_json_rpc::RpcError;
use alloy_primitives::{Address, U256};
use alloy_provider::Provider;
use alloy_rpc_types::{BlockNumberOrTag, BlockTransactionsKind, Filter, Log, TransactionTrait};
use alloy_sol_types::SolCall;
use alloy_transport::TransportErrorKind;
use hex::FromHexError;
use log::{debug, info};
use rusqlite::Connection;
use shielder_circuits::{grumpkin, GrumpkinPointAffine};
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{newAccountERC20Call, newAccountNativeCall},
    ShielderContractError,
};
use thiserror::Error;
use type_conversions::u256_to_field;

use crate::db::{self, ViewingKey};

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
    private_key_file: &str,
    connection: Connection,
) -> Result<(), CollectKeysError> {
    let provider = create_simple_provider(rpc_url).await?;
    let last_finalized_block_number = provider.get_block_number().await?;

    let private_key = grumpkin::Fr::from_bytes(&private_key_bytes(private_key_file)?)
        .into_option()
        .ok_or(CollectKeysError::NotAGrumpkinBaseFieldElement)?;

    db::create_viewing_keys_table(&connection)?;

    for block_number in 0..=last_finalized_block_number {
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
) -> Result<(), CollectKeysError> {
    let ciphertext1 = GrumpkinPointAffine::new(u256_to_field(c1x), u256_to_field(c1y));
    let ciphertext2 = GrumpkinPointAffine::new(u256_to_field(c2x), u256_to_field(c2y));

    let GrumpkinPointAffine { x, .. } =
        shielder_circuits::decrypt(ciphertext1.into(), ciphertext2.into(), private_key).into();

    info!("Viewing key decoding {x:?}");

    db::upsert_viewing_key(
        connection,
        ViewingKey {
            viewing_key: x.to_bytes().to_vec(),
        },
    )?;

    Ok(())
}

fn private_key_bytes(file: &str) -> Result<[u8; 32], io::Error> {
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

#[cfg(test)]
mod tests {
    use alloy_primitives::U256;
    use shielder_circuits::{poseidon::off_circuit::hash, Fr};
    use type_conversions::u256_to_field;

    #[test]
    fn playground() {
        let id: Fr = u256_to_field(
            U256::from_str_radix(
                "12149788709952380244401723958630103313911968813513728899550780481653393522559",
                10,
            )
            .unwrap(),
        );

        let k = shielder_circuits::derive_viewing_key(id);

        assert_eq!(
            "19769c8b7076367272d477448e16bb330398ebd68904a2ebcbc782d27461f61d",
            hex::encode(id.to_bytes())
        );

        // newAccountNativeCall { symKeyEncryptionC1X: 19420033340183974863144988685323206788530552163083436857825862470755451934532, symKeyEncryptionC1Y: 15788464705421795072282783992186344413433971611145706070618513891721409271871, symKeyEncryptionC2X: 20083755851364125692828215190025172084304637180713324842416894918800519417467, symKeyEncryptionC2Y: 21229363339025922855435477269821411877449531256069498533077213133643924118931,
        // macSalt: 6512694175196441965640539212879785744519546946999241152607882120108494685819
        // macCommitment: 17576897625927668035492046051895902740322805365345371972136249012400181210767

        let mac_salt: Fr = u256_to_field(
            U256::from_str_radix(
                "6512694175196441965640539212879785744519546946999241152607882120108494685819",
                10,
            )
            .unwrap(),
        );

        let mac_commitment: Fr = u256_to_field(
            U256::from_str_radix(
                "17576897625927668035492046051895902740322805365345371972136249012400181210767",
                10,
            )
            .unwrap(),
        );

        assert_eq!(hash(&[mac_salt, k]), mac_commitment);
    }
}
