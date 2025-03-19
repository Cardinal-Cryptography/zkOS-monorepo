use std::{
    cmp::min,
    fs::File,
    io::{self, Read},
    path::PathBuf,
};

use alloy_json_rpc::{RpcError, RpcParam, RpcReturn};
use alloy_primitives::Address;
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
pub enum RevokeError {
    #[error("Error while interacting with the Shielder contract")]
    Contract(#[from] ShielderContractError),

    #[error("RPC error")]
    Rpc(#[from] RpcError<TransportErrorKind>),

    #[error("Hex decoding error")]
    HexError(#[from] FromHexError),

    #[error("Error reading AR private key file")]
    ARKeyRead(#[from] std::io::Error),

    // Failed attempt to convert a little-endian byte representation of
    // a scalar into a scalar field element
    #[error("Error converting from LE byte representation to grumpkin::Fr")]
    NotAGrumpkinBaseFieldElement,
}

// TODO input: tx hash
// TODO: build DB view of history
// TODO : two step reveal
pub async fn run(
    rpc_url: &str,
    shielder_address: Address,
    private_key_file: String,
) -> Result<(), RevokeError> {
    // 1) TODO: go back in history and collect ALL viewing keys
    //       - look for new_account txs
    //       - read c1,c2 and decrypt it => k (viewing key)
    // read mac_commitmet = h(k, r) and r = mac_salt from the tx
    // publish k

    // 2) given k find all the matching txs
    //    - look if mac matches: mac_commitmet = h(k, r) and r = mac_salt from the tx

    let provider = create_simple_provider(rpc_url).await?;
    let last_block_number = provider.get_block_number().await?;

    for block_number in 0..=last_block_number {
        if let Some(block) = provider
            .get_block_by_number(
                BlockNumberOrTag::Number(block_number),
                BlockTransactionsKind::Full,
            )
            .await?
        {
            if let Some(txs) = block.transactions.as_transactions() {
                for tx in txs {
                    if let Ok(tx) = newAccountNativeCall::abi_decode(tx.input(), false) {
                        debug!("Decoded newAccountNative transaction {tx:?}");

                        let ciphertext1 = GrumpkinPointAffine::new(
                            u256_to_field(tx.symKeyEncryptionC1X),
                            u256_to_field(tx.symKeyEncryptionC1Y),
                        );
                        let ciphertext2 = GrumpkinPointAffine::new(
                            u256_to_field(tx.symKeyEncryptionC2X),
                            u256_to_field(tx.symKeyEncryptionC2Y),
                        );

                        let bytes = private_key_bytes(&private_key_file)?;
                        let private_key = grumpkin::Fr::from_bytes(&bytes)
                            .into_option()
                            .ok_or(RevokeError::NotAGrumpkinBaseFieldElement)?;

                        let GrumpkinPointAffine { x: viewing_key, .. } =
                            shielder_circuits::decrypt(
                                ciphertext1.into(),
                                ciphertext2.into(),
                                private_key,
                            )
                            .into();
                    }

                    if let Ok(tx) = newAccountERC20Call::abi_decode(tx.input(), false) {
                        debug!("Decoded newAccountERC20 transaction {tx:?}");
                        todo!("")
                    }
                }
            }
        }
    }

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
    use super::*;

    #[test]
    fn playground() {
        // TODO
        // id =  12149788709952380244401723958630103313911968813513728899550780481653393522559
        // u256 from str
        // field_element from u256
        // get a viewing key (from id)

        assert!(false);
    }
}
