import { Scalar } from "./scalar";
import {
  DepositPubInputs,
  DepositAdvice,
  NewAccountPubInputs,
  NewAccountAdvice,
  Proof,
  ShielderActionSecrets,
  WithdrawPubInputs,
  WithdrawAdvice
} from "./types";

export interface NewAccountCircuit {
  prove(values: NewAccountAdvice): Promise<Proof>;
  verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean>;
}

export interface DepositCircuit {
  prove(values: DepositAdvice): Promise<Proof>;
  verify(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean>;
}

export interface WithdrawCircuit {
  prove(values: WithdrawAdvice): Promise<Proof>;
  verify(proof: Proof, pubInputs: WithdrawPubInputs): Promise<boolean>;
}

export interface Hasher {
  poseidonHash(inputs: Scalar[]): Promise<Scalar>;
  // max number of inputs to the Poseidon hash function
  poseidonRate(): Promise<number>;
}

export interface SecretManager {
  getSecrets(id: Scalar, nonce: number): Promise<ShielderActionSecrets>;
}

export interface Converter {
  // convert a 32-byte hex (66 characters, starting with 0x) string to a Scalar
  privateKeyToScalar(hex: `0x${string}`): Promise<Scalar>;
}

export interface NoteTreeConfig {
  // the height of the note Merkle tree
  treeHeight(): Promise<number>;
  // the arity of the tree's nodes
  arity(): Promise<number>;
}

// Main interface that combines all crypto-related functionality
export interface CryptoClient {
  newAccountCircuit: NewAccountCircuit;
  depositCircuit: DepositCircuit;
  withdrawCircuit: WithdrawCircuit;
  hasher: Hasher;
  secretManager: SecretManager;
  converter: Converter;
  noteTreeConfig: NoteTreeConfig;
}
