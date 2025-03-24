use alloy_primitives::{Address, Bytes, FixedBytes, U256};
use rand::rngs::OsRng;
use shielder_circuits::{
    circuits::{Params, ProvingKey},
    consts::merkle_constants::{ARITY, NOTE_TREE_HEIGHT},
    deposit::DepositProverKnowledge,
    field_element_to_le_bits,
    new_account::NewAccountProverKnowledge,
    withdraw::WithdrawProverKnowledge,
    Field, Fr, GrumpkinPointAffine, ProverKnowledge, PublicInputProvider,
};
use shielder_contract::{
    ShielderContract::{
        depositERC20Call, depositNativeCall, newAccountERC20Call, newAccountNativeCall,
        withdrawERC20Call, withdrawNativeCall,
    },
    WithdrawCommitment,
};
use shielder_setup::version::{contract_version, ContractVersion};
use type_conversions::{address_to_field, field_to_address, field_to_u256, u256_to_field};

use crate::{ShielderAccount, Token};

struct ActionSecrets {
    nullifier_old: U256,
    trapdoor_old: U256,
    nullifier_new: U256,
    trapdoor_new: U256,
}

#[derive(Clone, Debug)]
pub struct CallTypeConversionError;

/// A trait for the different types of calls, for which calldata can be prepared based on the
/// ShielderAccount's state.
pub trait CallType {
    /// The extra data that is required for the call.
    type Extra;
    /// We suppose that every call has a corresponding circuit values struct used to generate a
    /// proof.
    type ProverKnowledge: ProverKnowledge;
    /// The type of the contract call data. Must be a type convertible to `SolCall`.
    type Calldata;

    /// Prepare the prover knowledge for the call.
    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        token: Token,
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
pub struct NewAccountCall {
    pub amount: U256,
    pub token: Token,
    pub expected_contract_version: FixedBytes<3>,
    pub new_note: U256,
    pub prenullifier: U256,
    pub sym_key_encryption_c1: GrumpkinPointAffine<U256>,
    pub sym_key_encryption_c2: GrumpkinPointAffine<U256>,
    pub mac_salt: U256,
    pub mac_commitment: U256,
    pub proof: Bytes,
}

impl TryFrom<NewAccountCall> for newAccountNativeCall {
    type Error = CallTypeConversionError;

    fn try_from(calldata: NewAccountCall) -> Result<Self, Self::Error> {
        match calldata.token {
            Token::Native => Ok(Self {
                expectedContractVersion: calldata.expected_contract_version,
                newNote: calldata.new_note,
                prenullifier: calldata.prenullifier,
                symKeyEncryptionC1X: calldata.sym_key_encryption_c1.x,
                symKeyEncryptionC1Y: calldata.sym_key_encryption_c1.y,
                symKeyEncryptionC2X: calldata.sym_key_encryption_c2.x,
                symKeyEncryptionC2Y: calldata.sym_key_encryption_c2.y,
                macSalt: calldata.mac_salt,
                macCommitment: calldata.mac_commitment,
                proof: calldata.proof,
            }),
            Token::ERC20(_) => Err(CallTypeConversionError),
        }
    }
}

impl TryFrom<NewAccountCall> for newAccountERC20Call {
    type Error = CallTypeConversionError;

    fn try_from(calldata: NewAccountCall) -> Result<Self, Self::Error> {
        match calldata.token {
            Token::Native => Err(CallTypeConversionError),
            Token::ERC20(token_address) => Ok(Self {
                tokenAddress: token_address,
                amount: calldata.amount,
                expectedContractVersion: calldata.expected_contract_version,
                newNote: calldata.new_note,
                prenullifier: calldata.prenullifier,
                symKeyEncryptionC1X: calldata.sym_key_encryption_c1.x,
                symKeyEncryptionC1Y: calldata.sym_key_encryption_c1.y,
                symKeyEncryptionC2X: calldata.sym_key_encryption_c2.x,
                symKeyEncryptionC2Y: calldata.sym_key_encryption_c2.y,
                macSalt: calldata.mac_salt,
                macCommitment: calldata.mac_commitment,
                proof: calldata.proof,
            }),
        }
    }
}

pub struct NewAccountCallExtra {
    pub anonymity_revoker_public_key: GrumpkinPointAffine<U256>,
    pub encryption_salt: U256,
    pub mac_salt: U256,
}

pub enum NewAccountCallType {}
impl CallType for NewAccountCallType {
    type Extra = NewAccountCallExtra;
    type ProverKnowledge = NewAccountProverKnowledge<Fr>;
    type Calldata = NewAccountCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        token: Token,
        amount: U256,
        extra: &Self::Extra,
    ) -> Self::ProverKnowledge {
        NewAccountProverKnowledge {
            id: u256_to_field(account.id),
            nullifier: u256_to_field(account.next_nullifier()),
            trapdoor: u256_to_field(account.next_trapdoor()),
            initial_deposit: u256_to_field(amount),
            token_address: address_to_field(token.address()),
            encryption_salt: field_element_to_le_bits::<Fr>(u256_to_field(extra.encryption_salt)),
            anonymity_revoker_public_key: GrumpkinPointAffine {
                x: u256_to_field(extra.anonymity_revoker_public_key.x),
                y: u256_to_field(extra.anonymity_revoker_public_key.y),
            },
            mac_salt: u256_to_field(extra.mac_salt),
        }
    }

    fn prepare_call_data(
        prover_knowledge: &Self::ProverKnowledge,
        proof: Vec<u8>,
        _: &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::new_account::NewAccountInstance::*;
        NewAccountCall {
            amount: field_to_u256(prover_knowledge.initial_deposit),
            token: field_to_address(prover_knowledge.token_address).into(),
            expected_contract_version: contract_version().to_bytes(),
            new_note: field_to_u256(prover_knowledge.compute_public_input(HashedNote)),
            prenullifier: field_to_u256(prover_knowledge.compute_public_input(Prenullifier)),
            sym_key_encryption_c1: GrumpkinPointAffine::<U256>::new(
                field_to_u256(prover_knowledge.compute_public_input(EncryptedKeyCiphertext1X)),
                field_to_u256(prover_knowledge.compute_public_input(EncryptedKeyCiphertext1Y)),
            ),
            sym_key_encryption_c2: GrumpkinPointAffine::<U256>::new(
                field_to_u256(prover_knowledge.compute_public_input(EncryptedKeyCiphertext2X)),
                field_to_u256(prover_knowledge.compute_public_input(EncryptedKeyCiphertext2Y)),
            ),
            mac_salt: field_to_u256(prover_knowledge.compute_public_input(MacSalt)),
            mac_commitment: field_to_u256(prover_knowledge.compute_public_input(MacCommitment)),
            proof: Bytes::from(proof),
        }
    }
}

#[derive(Clone, Debug)]
pub struct DepositCall {
    pub amount: U256,
    pub token: Token,
    pub expected_contract_version: FixedBytes<3>,
    pub old_nullifier_hash: U256,
    pub new_note: U256,
    pub merkle_root: U256,
    pub mac_salt: U256,
    pub mac_commitment: U256,
    pub proof: Bytes,
}

impl TryFrom<DepositCall> for depositNativeCall {
    type Error = CallTypeConversionError;

    fn try_from(calldata: DepositCall) -> Result<Self, Self::Error> {
        match calldata.token {
            Token::Native => Ok(Self {
                expectedContractVersion: calldata.expected_contract_version,
                oldNullifierHash: calldata.old_nullifier_hash,
                newNote: calldata.new_note,
                merkleRoot: calldata.merkle_root,
                macSalt: calldata.mac_salt,
                macCommitment: calldata.mac_commitment,
                proof: calldata.proof,
            }),
            Token::ERC20(_) => Err(CallTypeConversionError),
        }
    }
}

impl TryFrom<DepositCall> for depositERC20Call {
    type Error = CallTypeConversionError;

    fn try_from(calldata: DepositCall) -> Result<Self, Self::Error> {
        match calldata.token {
            Token::Native => Err(CallTypeConversionError),
            Token::ERC20(token_address) => Ok(Self {
                expectedContractVersion: calldata.expected_contract_version,
                tokenAddress: token_address,
                amount: calldata.amount,
                oldNullifierHash: calldata.old_nullifier_hash,
                newNote: calldata.new_note,
                merkleRoot: calldata.merkle_root,
                macSalt: calldata.mac_salt,
                macCommitment: calldata.mac_commitment,
                proof: calldata.proof,
            }),
        }
    }
}

pub struct DepositExtra {
    pub merkle_path: [[U256; ARITY]; NOTE_TREE_HEIGHT],
    pub mac_salt: U256,
}

pub enum DepositCallType {}
impl CallType for DepositCallType {
    type Extra = DepositExtra;
    type ProverKnowledge = DepositProverKnowledge<Fr>;

    type Calldata = DepositCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        token: Token,
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

        DepositProverKnowledge {
            id: u256_to_field(account.id),
            nullifier_old: u256_to_field(nullifier_old),
            trapdoor_old: u256_to_field(trapdoor_old),
            account_old_balance: u256_to_field(account.shielded_amount),
            token_address: address_to_field(token.address()),
            path: map_path_to_field(extra.merkle_path),
            deposit_value: u256_to_field(amount),
            nullifier_new: u256_to_field(nullifier_new),
            trapdoor_new: u256_to_field(trapdoor_new),
            mac_salt: u256_to_field(extra.mac_salt),
        }
    }

    fn prepare_call_data(
        pk: &Self::ProverKnowledge,
        proof: Vec<u8>,
        _: &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::deposit::DepositInstance::*;
        DepositCall {
            amount: field_to_u256(pk.deposit_value),
            token: field_to_address(pk.token_address).into(),
            expected_contract_version: contract_version().to_bytes(),
            old_nullifier_hash: field_to_u256(pk.compute_public_input(HashedOldNullifier)),
            new_note: field_to_u256(pk.compute_public_input(HashedNewNote)),
            merkle_root: field_to_u256(pk.compute_public_input(MerkleRoot)),
            mac_salt: field_to_u256(pk.compute_public_input(MacSalt)),
            mac_commitment: field_to_u256(pk.compute_public_input(MacCommitment)),
            proof: Bytes::from(proof.to_vec()),
        }
    }
}

#[derive(Clone, Debug)]
pub struct WithdrawCall {
    pub amount: U256,
    pub token: Token,
    pub expected_contract_version: FixedBytes<3>,
    pub withdrawal_address: Address,
    pub relayer_address: Address,
    pub merkle_root: U256,
    pub old_nullifier_hash: U256,
    pub new_note: U256,
    pub relayer_fee: U256,
    pub mac_salt: U256,
    pub mac_commitment: U256,
    pub proof: Bytes,
    pub pocket_money: U256,
}

impl TryFrom<WithdrawCall> for withdrawNativeCall {
    type Error = CallTypeConversionError;

    fn try_from(calldata: WithdrawCall) -> Result<Self, Self::Error> {
        match calldata.token {
            Token::Native => Ok(Self {
                expectedContractVersion: calldata.expected_contract_version,
                amount: calldata.amount,
                withdrawalAddress: calldata.withdrawal_address,
                merkleRoot: calldata.merkle_root,
                oldNullifierHash: calldata.old_nullifier_hash,
                newNote: calldata.new_note,
                proof: calldata.proof,
                relayerAddress: calldata.relayer_address,
                relayerFee: calldata.relayer_fee,
                macSalt: calldata.mac_salt,
                macCommitment: calldata.mac_commitment,
            }),
            Token::ERC20(_) => Err(CallTypeConversionError),
        }
    }
}

impl TryFrom<WithdrawCall> for withdrawERC20Call {
    type Error = CallTypeConversionError;

    fn try_from(calldata: WithdrawCall) -> Result<Self, Self::Error> {
        match calldata.token {
            Token::Native => Err(CallTypeConversionError),
            Token::ERC20(token_address) => Ok(Self {
                expectedContractVersion: calldata.expected_contract_version,
                tokenAddress: token_address,
                amount: calldata.amount,
                withdrawalAddress: calldata.withdrawal_address,
                merkleRoot: calldata.merkle_root,
                oldNullifierHash: calldata.old_nullifier_hash,
                newNote: calldata.new_note,
                proof: calldata.proof,
                relayerAddress: calldata.relayer_address,
                relayerFee: calldata.relayer_fee,
                macSalt: calldata.mac_salt,
                macCommitment: calldata.mac_commitment,
            }),
        }
    }
}

pub struct WithdrawExtra {
    pub merkle_path: [[U256; ARITY]; NOTE_TREE_HEIGHT],
    pub to: Address,
    pub relayer_address: Address,
    pub relayer_fee: U256,
    pub contract_version: ContractVersion,
    pub chain_id: U256,
    pub mac_salt: U256,
    pub pocket_money: U256,
}

pub enum WithdrawCallType {}
impl CallType for WithdrawCallType {
    type Extra = WithdrawExtra;
    type ProverKnowledge = WithdrawProverKnowledge<Fr>;
    type Calldata = WithdrawCall;

    fn prepare_prover_knowledge(
        account: &ShielderAccount,
        token: Token,
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
            chain_id: extra.chain_id,
            pocket_money: extra.pocket_money,
        }
        .commitment_hash();

        WithdrawProverKnowledge {
            id: u256_to_field(account.id),
            nullifier_old: u256_to_field(nullifier_old),
            trapdoor_old: u256_to_field(trapdoor_old),
            account_old_balance: u256_to_field(account.shielded_amount),
            token_address: address_to_field(token.address()),
            path: map_path_to_field(extra.merkle_path),
            withdrawal_value: u256_to_field(amount),
            nullifier_new: u256_to_field(nullifier_new),
            trapdoor_new: u256_to_field(trapdoor_new),
            commitment: u256_to_field(commitment),
            mac_salt: u256_to_field(extra.mac_salt),
        }
    }

    fn prepare_call_data(
        pk: &Self::ProverKnowledge,
        proof: Vec<u8>,
        extra: &Self::Extra,
    ) -> Self::Calldata {
        use shielder_circuits::circuits::withdraw::WithdrawInstance::*;
        WithdrawCall {
            expected_contract_version: contract_version().to_bytes(),
            token: field_to_address(pk.token_address).into(),
            amount: field_to_u256(pk.compute_public_input(WithdrawalValue)),
            withdrawal_address: extra.to,
            merkle_root: field_to_u256(pk.compute_public_input(MerkleRoot)),
            old_nullifier_hash: field_to_u256(pk.compute_public_input(HashedOldNullifier)),
            new_note: field_to_u256(pk.compute_public_input(HashedNewNote)),
            proof: Bytes::from(proof),
            relayer_address: extra.relayer_address,
            relayer_fee: extra.relayer_fee,
            mac_salt: field_to_u256(pk.compute_public_input(MacSalt)),
            mac_commitment: field_to_u256(pk.compute_public_input(MacCommitment)),
            pocket_money: extra.pocket_money,
        }
    }
}

impl ShielderAccount {
    pub fn prepare_call<CT: CallType>(
        &self,
        params: &Params,
        pk: &ProvingKey,
        token: Token,
        amount: U256,
        extra: &CT::Extra,
    ) -> CT::Calldata {
        let prover_knowledge = CT::prepare_prover_knowledge(self, token, amount, extra);
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
