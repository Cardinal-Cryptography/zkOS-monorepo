use std::sync::Arc;

#[cfg(not(feature = "without_attestation"))]
use aws_nitro_enclaves_nsm_api::{
    api::Request as NsmRequest,
    api::Response as NsmResponse,
    driver::{nsm_exit, nsm_init, nsm_process_request},
};
use ecies_encryption_lib::{generate_keypair, utils::to_hex, PrivKey, PubKey};
use log::{debug, info};
use serde::Deserialize;
use serde_json::Deserializer as JsonDeserializer;
use shielder_prover_common::{
    protocol::{CircuitType, Payload, ProverServer, Request, Response},
    vsock::VsockError,
};
use tokio_vsock::{VsockAddr, VsockListener, VsockStream, VMADDR_CID_ANY};

use crate::circuits::{
    deposit::SerializableDepositCircuit, new_account::SerializableNewAccountCircuit,
    withdraw::SerializableWithdrawCircuit, SerializableCircuit,
};

pub struct Server {
    private_key: Vec<u8>,
    public_key: Vec<u8>,

    #[cfg(not(feature = "without_attestation"))]
    nsm_fd: i32,

    listener: VsockListener,
}

impl Server {
    pub fn new(port: u16) -> Result<Arc<Self>, VsockError> {
        let address = VsockAddr::new(VMADDR_CID_ANY, port as u32);
        let listener = VsockListener::bind(address)?;
        info!("Generating server's asymmetric keys...");

        let (private_key, public_key) = generate_keypair();
        info!("Server's public key: {}", to_hex(&public_key.to_bytes()));

        #[cfg(not(feature = "without_attestation"))]
        let nsm_fd = Self::init_nsm_driver()?;

        #[cfg(feature = "without_attestation")]
        info!("Running server without attestation (TEST BUILD).");

        Ok(Arc::new(Self {
            listener,
            private_key: private_key.to_bytes(),
            public_key: public_key.to_bytes(),

            #[cfg(not(feature = "without_attestation"))]
            nsm_fd,
        }))
    }

    pub fn local_addr(&self) -> Result<VsockAddr, VsockError> {
        Ok(self.listener.local_addr()?)
    }

    pub fn listener(&self) -> &VsockListener {
        &self.listener
    }

    pub fn public_key(&self) -> Vec<u8> {
        self.public_key.clone()
    }
    pub async fn handle_client(self: Arc<Self>, stream: VsockStream) {
        let result = self.do_handle_client(stream).await;
        debug!("Client disconnected: {:?}", result);
    }

    async fn do_handle_client(&self, stream: VsockStream) -> Result<(), VsockError> {
        let mut server: ProverServer = stream.into();

        loop {
            server
                .handle_request(|request| match request {
                    Request::Ping => Ok(Response::Pong),
                    Request::TeePublicKey => self.public_key_response(),
                    Request::GenerateProof { payload } => {
                        let (proof, pub_inputs) = self.encrypted_proof_response(payload)?;
                        Ok(Response::EncryptedProof { proof, pub_inputs })
                    }
                })
                .await?;
        }
    }

    fn public_key_response(&self) -> Result<Response, VsockError> {
        let public_key = self.public_key();
        let public_key_hex = to_hex(&public_key);

        #[cfg(not(feature = "without_attestation"))]
        let attestation_document = self.request_attestation_from_nsm_driver(public_key)?;

        #[cfg(feature = "without_attestation")]
        let attestation_document = Vec::new();

        Ok(Response::TeePublicKey {
            public_key: public_key_hex,
            attestation_document,
        })
    }

    #[cfg(not(feature = "without_attestation"))]
    fn request_attestation_from_nsm_driver(
        &self,
        tee_public_key: Vec<u8>,
    ) -> Result<Vec<u8>, VsockError> {
        match nsm_process_request(
            self.nsm_fd,
            NsmRequest::Attestation {
                user_data: None,
                public_key: Some(tee_public_key.into()),
                nonce: None,
            },
        ) {
            NsmResponse::Attestation { document } => Ok(document),
            _ => Err(VsockError::Protocol(String::from(
                "NSM driver failed to compute attestation.",
            ))),
        }
    }

    fn encrypted_proof_response(
        &self,
        request_payload: Vec<u8>,
    ) -> Result<(Vec<u8>, Vec<u8>), VsockError> {
        let decrypted_payload = self.decrypt_using_servers_private_key(&request_payload)?;

        let decrypted_payload = str::from_utf8(&decrypted_payload).map_err(|_| {
            VsockError::Protocol(String::from("Failed to decode decrypted payload as UTF-8."))
        })?;
        let deserialized_payload: Payload = serde_json::from_str(decrypted_payload)?;

        let (proof, pub_inputs) = Self::compute_proof(
            &deserialized_payload.circuit_inputs,
            deserialized_payload.circuit_type,
        )?;
        let encrypted_proof = Self::encrypt_bytes(&deserialized_payload.user_public_key, proof)?;
        let encrypted_pub_inputs =
            Self::encrypt_bytes(&deserialized_payload.user_public_key, pub_inputs)?;

        Ok((encrypted_proof, encrypted_pub_inputs))
    }

    fn encrypt_bytes(user_public_key: &[u8], bytes: Vec<u8>) -> Result<Vec<u8>, VsockError> {
        let pub_key = PubKey::from_bytes(user_public_key)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        let encrypted_bytes = ecies_encryption_lib::encrypt(bytes.as_slice(), &pub_key);
        Ok(encrypted_bytes)
    }

    fn compute_proof(
        serialized_circuit_inputs: &[u8],
        circuit_type: CircuitType,
    ) -> Result<(Vec<u8>, Vec<u8>), VsockError> {
        let (proof, pub_inputs) = match circuit_type {
            CircuitType::NewAccount => Self::compute_proof_for_circuit(
                serialized_circuit_inputs,
                SerializableNewAccountCircuit::new(),
            )?,
            CircuitType::Deposit => Self::compute_proof_for_circuit(
                serialized_circuit_inputs,
                SerializableDepositCircuit::new(),
            )?,
            CircuitType::Withdraw => Self::compute_proof_for_circuit(
                serialized_circuit_inputs,
                SerializableWithdrawCircuit::new(),
            )?,
        };
        Ok((proof, pub_inputs))
    }

    fn compute_proof_for_circuit<C>(
        serialized_circuit_inputs: &[u8],
        circuit: C,
    ) -> Result<(Vec<u8>, Vec<u8>), VsockError>
    where
        C: SerializableCircuit,
    {
        let mut json_deserializer = JsonDeserializer::from_reader(serialized_circuit_inputs);
        let circuit_pub_inputs_bytes = C::Input::deserialize(&mut json_deserializer)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        let pub_inputs_bytes = C::pub_inputs(circuit_pub_inputs_bytes.clone());
        // prove() might panic, which won't be caught here, however default behaviour of this server is to ignore panic
        // see https://docs.rs/tokio/latest/tokio/runtime/enum.UnhandledPanic.html#variant.Ignore
        Ok((
            circuit.prove(circuit_pub_inputs_bytes),
            serde_json::to_vec(&pub_inputs_bytes)?,
        ))
    }

    fn decrypt_using_servers_private_key(
        &self,
        request_payload: &[u8],
    ) -> Result<Vec<u8>, VsockError> {
        let private_key = PrivKey::from_bytes(self.private_key.as_slice())
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        let decrypted_payload = ecies_encryption_lib::decrypt(request_payload, &private_key)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        Ok(decrypted_payload)
    }

    #[cfg(not(feature = "without_attestation"))]
    fn init_nsm_driver() -> Result<i32, VsockError> {
        info!("Opening file descriptor to /dev/nsm driver.");
        let nsm_fd = nsm_init();

        if nsm_fd < 0 {
            return Err(VsockError::Protocol(String::from(
                "Failed to initialize NSM driver.",
            )));
        }

        Ok(nsm_fd)
    }
}

#[cfg(not(feature = "without_attestation"))]
impl Drop for Server {
    fn drop(&mut self) {
        info!("Closing file descriptor to /dev/nsm driver.");
        nsm_exit(self.nsm_fd);
    }
}
