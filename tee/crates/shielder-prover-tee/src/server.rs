use std::sync::Arc;
use log::{debug, info};
use tokio_vsock::{VsockAddr, VsockListener, VsockStream, VMADDR_CID_ANY};
use shielder_prover_common::protocol::{ProverServer, Request, Response};
use shielder_prover_common::vsock::VsockError;
use ecies_encryption_lib::{generate_keypair, PrivKey, PubKey};
use ecies_encryption_lib::utils::{from_hex, to_hex};
use serde::{Deserialize};
use serde_json::Deserializer;
use crate::circuits::{CircuitType, SerializableCircuit};
use crate::circuits::deposit::SerializableDepositCircuit;
use crate::circuits::new_account::SerializableNewAccountCircuit;
use crate::circuits::withdraw::SerializableWithdrawCircuit;

pub struct Server {
    private_key: Vec<u8>,
    public_key: Vec<u8>,

    listener: VsockListener,
}

impl Server {
    pub fn new(port: u32) -> Result<Arc<Self>, VsockError> {
        let address = VsockAddr::new(VMADDR_CID_ANY, port);
        let listener = VsockListener::bind(address)?;
        info!("Generating server's asymmetric keys...");

        let (private_key, public_key) = generate_keypair();
        info!("Server's public key: {}", to_hex(&public_key.to_bytes()));

        Ok(Arc::new(Self {
            listener,
            private_key: private_key.to_bytes(),
            public_key: public_key.to_bytes(),
        }))
    }

    pub fn local_addr(&self) -> Result<VsockAddr, VsockError> {
        Ok(self.listener.local_addr()?)
    }

    pub fn listener(&self) -> &VsockListener {
        &self.listener
    }

    pub fn public_key(&self) -> Vec<u8>{
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
                    Request::TeePublicKey => Ok(Response::TeePublicKey{ public_key : to_hex(&self.public_key())}),
                    Request::GenerateProof {payload, user_public_key} => {
                            let (proof, pub_inputs) = self.encrypted_proof_response(payload, user_public_key)?;
                            Ok(Response::EncryptedProof{
                                proof,
                                pub_inputs,
                            })
                        }
                })
                .await?;
        }
    }

    fn encrypted_proof_response(&self, request_payload: Vec<u8>, user_public_key: String) -> Result<(Vec<u8>, Vec<u8>), VsockError>  {
        let decrypted_payload = self.decrypt_request_payload(&request_payload)?;

        let circuit_type = Self::extract_circuit_type(&decrypted_payload)?;
        let (proof, pub_inputs) = Self::compute_proof(&decrypted_payload[1..], circuit_type)?;
        let encrypted_proof = Self::encrypt_proof(&user_public_key, proof)?;
        // TODO: does pub_inputs needs to be encrypted?

        Ok((encrypted_proof, pub_inputs))
    }

    fn encrypt_proof(user_public_key: &String, proof: Vec<u8>) -> Result<Vec<u8>, VsockError> {
        let user_public_key = from_hex(&user_public_key)
            .map_err(|conversion_error| VsockError::Protocol(conversion_error.to_string()))?;
        let pub_key = PubKey::from_bytes(&user_public_key)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        let encrypted_proof = ecies_encryption_lib::encrypt(proof.as_slice(), &pub_key);
        Ok(encrypted_proof)
    }

    fn compute_proof(input_bytes: &[u8], circuit_type: CircuitType) -> Result<(Vec<u8>, Vec<u8>), VsockError> {
        let (proof, pub_inputs) = match circuit_type {
            CircuitType::NewAccount =>
                Self::compute_proof_for_circuit(input_bytes, SerializableNewAccountCircuit::new())?,
            CircuitType::Deposit =>
                Self::compute_proof_for_circuit(input_bytes, SerializableDepositCircuit::new())?,
            CircuitType::Withdraw =>
                Self::compute_proof_for_circuit(input_bytes, SerializableWithdrawCircuit::new())?,
        };
        Ok((proof, pub_inputs))
    }

    fn compute_proof_for_circuit<C>(input_bytes: &[u8], circuit: C) -> Result<(Vec<u8>, Vec<u8>), VsockError>
    where
        C: SerializableCircuit,
    {
        let mut de = Deserializer::from_reader(input_bytes);
        let circuit_pub_inputs_bytes = C::Input::deserialize(&mut de)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        let pub_inputs_bytes = C::pub_inputs(circuit_pub_inputs_bytes.clone());
        // prove() might panic, which won't be caught here, however default behaviour of this server is to ignore panic
        // see https://docs.rs/tokio/latest/tokio/runtime/enum.UnhandledPanic.html#variant.Ignore
        Ok((circuit.prove(circuit_pub_inputs_bytes), serde_json::to_vec(&pub_inputs_bytes)?))
    }

    fn extract_circuit_type(decrypted_payload: &Vec<u8>) -> Result<CircuitType, VsockError> {
        if decrypted_payload.is_empty() {
            return Err(VsockError::Protocol(String::from("Decrypted payload is empty.")));
        }
        let payload_first_byte = decrypted_payload[0];
        let circuit_type = CircuitType::try_from(payload_first_byte)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        Ok(circuit_type)
    }

    fn decrypt_request_payload(&self, request_payload: &Vec<u8>) -> Result<Vec<u8>, VsockError> {
        let private_key = PrivKey::from_bytes(self.private_key.as_slice())
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        let decrypted_payload = ecies_encryption_lib::decrypt(&request_payload, &private_key)
            .map_err(|error| VsockError::Protocol(error.to_string()))?;
        Ok(decrypted_payload)
    }
}


