use std::sync::Arc;

use alloy_network::{Ethereum, EthereumWallet, Network};
use alloy_provider::{
    fillers::{
        BlobGasFiller, CachedNonceManager, ChainIdFiller, FillerControlFlow, GasFiller,
        NonceFiller, TxFiller, WalletFiller,
    },
    Provider, ProviderBuilder, SendableTx,
};
use alloy_signer_local::PrivateKeySigner;
use alloy_transport::{Transport, TransportResult};

use crate::{ContractResult, ShielderContractError};

/// Creates a provider for the given RPC URL. This is a simple provider, without any fillers or
/// signer configuration (apart from some devnet-specific defaults). It is suitable for doing
/// read-only operations.
pub async fn create_simple_provider(rpc_url: &str) -> ContractResult<impl Provider> {
    ProviderBuilder::new()
        .on_builtin(rpc_url)
        .await
        .map_err(ShielderContractError::ProviderError)
}

/// Creates a provider for the given RPC URL, with the given signer. This provider is suitable for
/// doing write operations, as it will sign transactions with the given signer.
///
/// Note: The signer will fetch the nonce before every transaction. Use this if the same signer
/// might be used from multiple places (although bare in mind that nonce conflicts might still
/// occur).
pub async fn create_provider_with_signer(
    rpc_url: &str,
    signer: PrivateKeySigner,
) -> ContractResult<impl Provider + Clone> {
    ProviderBuilder::new()
        .with_recommended_fillers()
        .filler(WalletFiller::new(EthereumWallet::from(signer)))
        .on_builtin(rpc_url)
        .await
        .map_err(ShielderContractError::ProviderError)
}

/// Creates a provider for the given RPC URL, with the given signer. This provider is suitable for
/// doing write operations, as it will sign transactions with the given signer.
///
/// Note: The signer will locally track the nonce and cache it. Use this if the signer is only used
/// from one place.
pub async fn create_provider_with_nonce_caching_signer(
    rpc_url: &str,
    signer: PrivateKeySigner,
) -> ContractResult<impl Provider + Clone> {
    ProviderBuilder::new()
        // The four fillers below are the recommended fillers are the same as
        // `with_recommended_fillers` except the `NonceManager` parameter for `NonceFiller`.
        .filler(GasFiller)
        .filler(BlobGasFiller)
        .filler(NonceFiller::<CachedNonceManager>::default())
        .filler(ChainIdFiller::default())
        .filler(WalletFiller::new(EthereumWallet::from(signer)))
        .filler(LoggingFiller::default())
        .on_builtin(rpc_url)
        .await
        .map_err(ShielderContractError::ProviderError)
        .map(Arc::new)
}

/// A noop filler that reports transaction details once it is prepared, just before sending. For
/// debugging purposes.
#[derive(Copy, Clone, Debug, Default)]
pub struct LoggingFiller {}

impl TxFiller for LoggingFiller {
    type Fillable = ();

    fn status(&self, _tx: &<Ethereum as Network>::TransactionRequest) -> FillerControlFlow {
        FillerControlFlow::Finished
    }

    fn fill_sync(&self, tx: &mut SendableTx<Ethereum>) {
        match tx {
            SendableTx::Builder(tx) => {
                tracing::info!(sender = ?tx.from, to = ?tx.to, nonce = tx.nonce, "Sending a transaction");
            }
            SendableTx::Envelope(_) => {} // We don't use envelopes in this crate.
        }
    }

    async fn prepare<P: Provider<T, Ethereum>, T: Transport + Clone>(
        &self,
        _provider: &P,
        _tx: &<Ethereum as Network>::TransactionRequest,
    ) -> TransportResult<Self::Fillable> {
        Ok(())
    }

    async fn fill(
        &self,
        _fillable: Self::Fillable,
        tx: SendableTx<Ethereum>,
    ) -> TransportResult<SendableTx<Ethereum>> {
        Ok(tx)
    }
}
