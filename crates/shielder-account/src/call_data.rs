use alloy_primitives::{Address, Bytes, U256};
use rand::rngs::OsRng;
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
    deposit::DepositProverKnowledge,
    new_account::NewAccountProverKnowledge,
    withdraw::WithdrawProverKnowledge,
    Field, Fr, ProverKnowledge, PublicInputProvider,
};
use shielder_contract::{
    ShielderContract::{depositNativeCall, newAccountNativeCall, withdrawNativeCall},
    WithdrawCommitment,
};
use shielder_setup::{
    native_token::NATIVE_TOKEN_ADDRESS,
    version::{contract_version, ContractVersion},
};
use type_conversions::{field_to_u256, u256_to_field};

use super::secrets::id_hiding_nonce;
use crate::ShielderAccount;

struct ActionSecrets {
    nullifier_old: U256,
    trapdoor_old: U256,
    nullifier_new: U256,
    trapdoor_new: U256,
}

/// A trait for the different types of calls, for which calldata can be prepared based on the
/// ShielderAccount's state.
pub trait CallType {
    /// The extra data that is required for the call.
    type Extra;
    /// We suppose that every call has a corresponding circuit values struct used to generate a
    /// proof.
    type ProverKnowledge: ProverKnowledge;
    /// The type of the contract call data.
    type Calldata;

    /// Prepare the prover knowledge for the call.
    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        extra: &Self::Extra,
    ) -> Self::ProverKnowledge;

    /// Prepare the call data for the contract call.
    fn prepare_call_data(
        prover_knowledge: &Self::ProverKnowledge,
        proof: Vec<u8>,
        extra: &Self::Extra,
    ) -> Self::Calldata;
}

pub enum NewAccountCallType {}
impl CallType for NewAccountCallType {
    type Extra = U256; // temporarily; target: `AsymPublicKey` (not yet visible)
    type ProverKnowledge = NewAccountProverKnowledge<Fr>;
    type Calldata = newAccountNativeCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        anonymity_revoker_public_key: &Self::Extra,
    ) -> Self::ProverKnowledge {
        NewAccountProverKnowledge {
            id: u256_to_field(account.id),
            nullifier: u256_to_field(account.next_nullifier()),
            trapdoor: u256_to_field(account.next_trapdoor()),
            initial_deposit: u256_to_field(amount),
            token_address: NATIVE_TOKEN_ADDRESS,
            anonymity_revoker_public_key: u256_to_field(anonymity_revoker_public_key),
        }
    }

    fn prepare_call_data(
        prover_knowledge: &Self::ProverKnowledge,
        proof: Vec<u8>,
        _: &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::new_account::NewAccountInstance::*;
        newAccountNativeCall {
            expectedContractVersion: contract_version().to_bytes(),
            newNote: field_to_u256(prover_knowledge.compute_public_input(HashedNote)),
            idHash: field_to_u256(prover_knowledge.compute_public_input(HashedId)),
            symKeyEncryption: field_to_u256(
                prover_knowledge.compute_public_input(SymKeyEncryption),
            ),
            proof: Bytes::from(proof),
        }
    }
}

pub struct MerkleProof {
    pub root: U256,
    pub path: [[U256; ARITY]; NOTE_TREE_HEIGHT],
}

pub enum DepositCallType {}
impl CallType for DepositCallType {
    type Extra = MerkleProof;
    type ProverKnowledge = DepositProverKnowledge<Fr>;

    type Calldata = depositNativeCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        merkle: &Self::Extra,
    ) -> Self::ProverKnowledge {
        let ActionSecrets {
            nullifier_old,
            trapdoor_old,
            nullifier_new,
            trapdoor_new,
            ..
        } = account.get_secrets();

        let nonce = id_hiding_nonce();

        DepositProverKnowledge {
            id: u256_to_field(account.id),
            nonce: u256_to_field(nonce),
            nullifier_old: u256_to_field(nullifier_old),
            trapdoor_old: u256_to_field(trapdoor_old),
            account_old_balance: u256_to_field(account.shielded_amount),
            token_address: NATIVE_TOKEN_ADDRESS,
            path: map_path_to_field(merkle.path),
            deposit_value: u256_to_field(amount),
            nullifier_new: u256_to_field(nullifier_new),
            trapdoor_new: u256_to_field(trapdoor_new),
        }
    }

    fn prepare_call_data(
        pk: &Self::ProverKnowledge,
        proof: Vec<u8>,
        _: &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::deposit::DepositInstance::*;
        depositNativeCall {
            expectedContractVersion: contract_version().to_bytes(),
            idHiding: field_to_u256(pk.compute_public_input(IdHiding)),
            oldNullifierHash: field_to_u256(pk.compute_public_input(HashedOldNullifier)),
            newNote: field_to_u256(pk.compute_public_input(HashedNewNote)),
            merkleRoot: field_to_u256(pk.compute_public_input(MerkleRoot)),
            proof: Bytes::from(proof.to_vec()),
        }
    }
}

pub struct WithdrawExtra {
    pub merkle_proof: MerkleProof,
    pub to: Address,
    pub relayer_address: Address,
    pub relayer_fee: U256,
    pub contract_version: ContractVersion,
}

pub enum WithdrawCallType {}
impl CallType for WithdrawCallType {
    type Extra = WithdrawExtra;
    type ProverKnowledge = WithdrawProverKnowledge<Fr>;
    type Calldata = withdrawNativeCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        extra: &Self::Extra,
    ) -> Self::ProverKnowledge {
        let ActionSecrets {
            nullifier_old,
            trapdoor_old,
            nullifier_new,
            trapdoor_new,
            ..
        } = account.get_secrets();

        let commitment = WithdrawCommitment {
            contract_version: extra.contract_version,
            withdraw_address: extra.to,
            relayer_address: extra.relayer_address,
            relayer_fee: extra.relayer_fee,
        }
        .commitment_hash();
        let nonce = id_hiding_nonce();

        WithdrawProverKnowledge {
            id: u256_to_field(account.id),
            nonce: u256_to_field(nonce),
            nullifier_old: u256_to_field(nullifier_old),
            trapdoor_old: u256_to_field(trapdoor_old),
            account_old_balance: u256_to_field(account.shielded_amount),
            token_address: NATIVE_TOKEN_ADDRESS,
            path: map_path_to_field(extra.merkle_proof.path),
            withdrawal_value: u256_to_field(amount),
            nullifier_new: u256_to_field(nullifier_new),
            trapdoor_new: u256_to_field(trapdoor_new),
            commitment: u256_to_field(commitment),
        }
    }

    fn prepare_call_data(
        pk: &Self::ProverKnowledge,
        proof: Vec<u8>,
        extra: &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::withdraw::WithdrawInstance::*;
        withdrawNativeCall {
            expectedContractVersion: contract_version().to_bytes(),
            idHiding: field_to_u256(pk.compute_public_input(IdHiding)),
            amount: field_to_u256(pk.compute_public_input(WithdrawalValue)),
            withdrawalAddress: extra.to,
            merkleRoot: field_to_u256(pk.compute_public_input(MerkleRoot)),
            oldNullifierHash: field_to_u256(pk.compute_public_input(HashedOldNullifier)),
            newNote: field_to_u256(pk.compute_public_input(HashedNewNote)),
            proof: Bytes::from(proof),
            relayerAddress: extra.relayer_address,
            relayerFee: extra.relayer_fee,
        }
    }
}

impl ShielderAccount {
    pub fn prepare_call<CT: CallType>(
        &self,
        params: &Params,
        pk: &ProvingKey,
        amount: U256,
        extra: &CT::Extra,
    ) -> CT::Calldata {
        let prover_knowledge = CT::prepare_prover_knowledge(self, amount, extra);
        let proof = generate_proof(params, pk, &prover_knowledge);
        CT::prepare_call_data(&prover_knowledge, proof, extra)
    }

    fn get_secrets(&self) -> ActionSecrets {
        let nullifier_old = self.previous_nullifier();
        let trapdoor_old = self
            .previous_trapdoor()
            .expect("The first action cannot refer to a previous trapdoor");

        let nullifier_new = self.next_nullifier();
        let trapdoor_new = self.next_trapdoor();

        ActionSecrets {
            nullifier_old,
            trapdoor_old,
            nullifier_new,
            trapdoor_new,
        }
    }
}

fn generate_proof(
    params: &Params,
    pk: &ProvingKey,
    prover_knowledge: &impl ProverKnowledge,
) -> Vec<u8> {
    shielder_circuits::generate_proof(
        params,
        pk,
        prover_knowledge.create_circuit(),
        &prover_knowledge.serialize_public_input(),
        &mut OsRng,
    )
}

fn map_path_to_field(path: [[U256; ARITY]; NOTE_TREE_HEIGHT]) -> [[Fr; ARITY]; NOTE_TREE_HEIGHT] {
    let mut result = [[Fr::ZERO; ARITY]; NOTE_TREE_HEIGHT];
    for (i, row) in path.iter().enumerate() {
        for (j, element) in row.iter().enumerate() {
            result[i][j] = u256_to_field(*element);
        }
    }
    result
}
