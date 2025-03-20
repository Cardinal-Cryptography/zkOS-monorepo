use std::{
    cmp::min,
    fs::File,
    io::{self, Read},
    path::PathBuf,
};

use alloy_json_rpc::{RpcError, RpcParam, RpcReturn};
use alloy_primitives::{Address, U256};
use alloy_provider::Provider;
use alloy_rpc_types::{BlockNumberOrTag, BlockTransactionsKind, Filter, Log, TransactionTrait};
use alloy_sol_types::SolCall;
use alloy_transport::TransportErrorKind;
use hex::FromHexError;
use log::{debug, info, trace};
use shielder_circuits::{grumpkin, Fr, GrumpkinPointAffine};
use shielder_contract::{
    providers::create_simple_provider,
    ShielderContract::{
        newAccountERC20Call, newAccountNativeCall, ShielderContractCalls::newAccountNative,
    },
    ShielderContractError,
};
use thiserror::Error;
use type_conversions::u256_to_field;

const BATCH_SIZE: usize = 10_000;

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
}

// Goes back in transaction history and collects all viewing keys
// - look for new_account txs
// - read c1,c2
// - decrypt message  => k (viewing key)
// - record k
pub async fn run(
    rpc_url: &str,
    shielder_address: &Address,
    private_key_file: &str,
) -> Result<(), CollectKeysError> {
    let provider = create_simple_provider(rpc_url).await?;
    let last_finalized_block_number = provider.get_block_number().await?;

    let private_key = grumpkin::Fr::from_bytes(&private_key_bytes(private_key_file)?)
        .into_option()
        .ok_or(CollectKeysError::NotAGrumpkinBaseFieldElement)?;

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

    Ok(())
}

fn decode_and_persist(
    symKeyEncryptionC1X: U256,
    symKeyEncryptionC1Y: U256,
    symKeyEncryptionC2X: U256,
    symKeyEncryptionC2Y: U256,
    private_key: grumpkin::Fr,
) -> Result<(), CollectKeysError> {
    let ciphertext1 = GrumpkinPointAffine::new(
        u256_to_field(symKeyEncryptionC1X),
        u256_to_field(symKeyEncryptionC1Y),
    );
    let ciphertext2 = GrumpkinPointAffine::new(
        u256_to_field(symKeyEncryptionC2X),
        u256_to_field(symKeyEncryptionC2Y),
    );

    let GrumpkinPointAffine { x: viewing_key, .. } =
        shielder_circuits::decrypt(ciphertext1.into(), ciphertext2.into(), private_key).into();

    // TODO: persist
    info!("Viewing key decoding {viewing_key:?}");

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
    use shielder_circuits::poseidon::off_circuit::hash;
    use type_conversions::field_to_u256;

    use super::*;

    #[test]
    fn playground() {
        // TODO
        let src = "12149788709952380244401723958630103313911968813513728899550780481653393522559";
        let id = U256::from_str_radix(src, 10).unwrap();
        let id_in_the_field: Fr = u256_to_field(id);

        let repr = id_in_the_field.to_bytes();
        let he = hex::encode(repr);

        let k = shielder_circuits::derive_viewing_key(id_in_the_field);

        // 0x19769c8b7076367272d477448e16bb330398ebd68904a2ebcbc782d27461f61d
        println!("k: {k:?}");

        // newAccountNativeCall { symKeyEncryptionC1X: 19420033340183974863144988685323206788530552163083436857825862470755451934532, symKeyEncryptionC1Y: 15788464705421795072282783992186344413433971611145706070618513891721409271871, symKeyEncryptionC2X: 20083755851364125692828215190025172084304637180713324842416894918800519417467, symKeyEncryptionC2Y: 21229363339025922855435477269821411877449531256069498533077213133643924118931,
        // macSalt: 6512694175196441965640539212879785744519546946999241152607882120108494685819
        // macCommitment: 17576897625927668035492046051895902740322805365345371972136249012400181210767

        let mac_salt =
            "6512694175196441965640539212879785744519546946999241152607882120108494685819";
        let mac_salt = U256::from_str_radix(mac_salt, 10).unwrap();
        let mac_salt: Fr = u256_to_field(mac_salt);

        let mac_commitment =
            "17576897625927668035492046051895902740322805365345371972136249012400181210767";
        let mac_commitment = U256::from_str_radix(mac_commitment, 10).unwrap();
        let mac_commitment: Fr = u256_to_field(mac_commitment);

        let com = hash(&[mac_salt, k]);

        assert_eq!(com, mac_commitment);
    }
}
