import { Scalar } from "./scalar";
import {
  DepositPubInputs,
  DepositValues,
  NewAccountPubInputs,
  NewAccountValues,
  Proof,
  ShielderActionSecrets,
  WithdrawPubInputs,
  WithdrawValues
} from "./types";

export interface NewAccountCircuit {
  prove(values: NewAccountValues): Promise<Proof>;
  verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean>;
}

export interface DepositCircuit {
  prove(values: DepositValues): Promise<Proof>;
  verify(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean>;
}

export interface WithdrawCircuit {
  prove(values: WithdrawValues): Promise<Proof>;
  verify(proof: Proof, pubInputs: WithdrawPubInputs): Promise<boolean>;
}

export interface Hasher {
  poseidonHash(inputs: Scalar[]): Promise<Scalar>;
}

export interface SecretManager {
  getSecrets(id: Scalar, nonce: number): Promise<ShielderActionSecrets>;
}

export interface Converter {
  privateKeyToScalar(hex: `0x${string}`): Promise<Scalar>;
}

export interface NoteTreeConfig {
  treeHeight(): Promise<number>;
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
