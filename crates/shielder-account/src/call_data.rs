use alloy_primitives::{Address, Bytes, FixedBytes, U256};
use rand::rngs::OsRng;
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
    deposit::DepositProverKnowledge,
    new_account::NewAccountProverKnowledge,
    withdraw::WithdrawProverKnowledge,
    AsymPublicKey, Field, Fr, ProverKnowledge, PublicInputProvider,
};
use shielder_contract::{
    ShielderContract::{
        depositNativeCall, newAccountERC20Call, newAccountNativeCall, withdrawNativeCall,
    },
    WithdrawCommitment,
};
use shielder_setup::{
    native_token::NATIVE_TOKEN_ADDRESS,
    version::{contract_version, ContractVersion},
};
use type_conversions::{address_to_field, field_to_u256, u256_to_field};

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

#[derive(Clone, Debug)]
pub struct NewAccountGenericCall {
    pub amount: U256,
    pub token_address: Address,
    pub expected_contract_version: FixedBytes<3>,
    pub new_note: U256,
    pub id_hash: U256,
    pub sym_key_encryption: U256,
    pub proof: Bytes,
}

impl From<NewAccountGenericCall> for newAccountNativeCall {
    fn from(calldata: NewAccountGenericCall) -> Self {
        Self {
            expectedContractVersion: calldata.expected_contract_version,
            newNote: calldata.new_note,
            idHash: calldata.id_hash,
            symKeyEncryption: calldata.sym_key_encryption,
            proof: calldata.proof,
        }
    }
}

impl From<NewAccountGenericCall> for newAccountERC20Call {
    fn from(calldata: NewAccountGenericCall) -> Self {
        Self {
            expectedContractVersion: calldata.expected_contract_version,
            newNote: calldata.new_note,
            idHash: calldata.id_hash,
            symKeyEncryption: calldata.sym_key_encryption,
            proof: calldata.proof,
            tokenAddress: calldata.token_address,
            amount: calldata.amount,
        }
    }
}

pub enum NewAccountGenericCallType {}
impl CallType for NewAccountGenericCallType {
    type Extra = (Address, AsymPublicKey<U256>);
    type ProverKnowledge = NewAccountProverKnowledge<Fr>;
    type Calldata = NewAccountGenericCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        (token_address, anonymity_revoker_public_key): &Self::Extra,
    ) -> Self::ProverKnowledge {
        NewAccountProverKnowledge {
            id: u256_to_field(account.id),
            nullifier: u256_to_field(account.next_nullifier()),
            trapdoor: u256_to_field(account.next_trapdoor()),
            initial_deposit: u256_to_field(amount),
            token_address: address_to_field(*token_address),
            anonymity_revoker_public_key: AsymPublicKey::<Fr> {
                x: u256_to_field::<Fr>(anonymity_revoker_public_key.x),
                y: u256_to_field::<Fr>(anonymity_revoker_public_key.y),
            },
        }
    }

    fn prepare_call_data(
        prover_knowledge: &Self::ProverKnowledge,
        proof: Vec<u8>,
        (token_address, _): &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::new_account::NewAccountInstance::*;
        NewAccountGenericCall {
            expected_contract_version: contract_version().to_bytes(),
            new_note: field_to_u256(prover_knowledge.compute_public_input(HashedNote)),
            id_hash: field_to_u256(prover_knowledge.compute_public_input(HashedId)),
            sym_key_encryption: field_to_u256(
                prover_knowledge.compute_public_input(SymKeyEncryption),
            ),
            amount: field_to_u256(prover_knowledge.initial_deposit),
            token_address: *token_address,
            proof: Bytes::from(proof),
        }
    }
}

pub enum NewAccountNativeCallType {}
impl CallType for NewAccountNativeCallType {
    type Extra = (Address, AsymPublicKey<U256>);
    type ProverKnowledge = NewAccountProverKnowledge<Fr>;
    type Calldata = newAccountNativeCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        extra: &Self::Extra,
    ) -> Self::ProverKnowledge {
        NewAccountGenericCallType::prepare_prover_knowledge(account, amount, extra)
    }

    fn prepare_call_data(
        prover_knowledge: &Self::ProverKnowledge,
        proof: Vec<u8>,
        extra: &Self::Extra,
    ) -> Self::Calldata {
        let calldata = NewAccountGenericCallType::prepare_call_data(prover_knowledge, proof, extra);
        calldata.into()
    }
}

pub enum NewAccountERC20CallType {}
impl CallType for NewAccountERC20CallType {
    type Extra = (Address, AsymPublicKey<U256>);
    type ProverKnowledge = NewAccountProverKnowledge<Fr>;
    type Calldata = newAccountERC20Call;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        amount: U256,
        extra: &Self::Extra,
    ) -> Self::ProverKnowledge {
        NewAccountGenericCallType::prepare_prover_knowledge(account, amount, extra)
    }

    fn prepare_call_data(
        prover_knowledge: &Self::ProverKnowledge,
        proof: Vec<u8>,
        extra: &Self::Extra,
    ) -> Self::Calldata {
        let calldata = NewAccountGenericCallType::prepare_call_data(prover_knowledge, proof, extra);
        calldata.into()
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
            mac_salt: u256_to_field(account.mac_salt),
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
            macSalt: field_to_u256(pk.compute_public_input(MacSalt)),
            macCommitment: field_to_u256(pk.compute_public_input(MacCommitment)),
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
            mac_salt: u256_to_field(account.mac_salt),
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
            macSalt: field_to_u256(pk.compute_public_input(MacSalt)),
            macCommitment: field_to_u256(pk.compute_public_input(MacCommitment)),
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
