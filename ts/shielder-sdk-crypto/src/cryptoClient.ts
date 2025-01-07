import {
  DepositPubInputs,
  DepositValues,
  NewAccountPubInputs,
  NewAccountValues,
  Proof,
  Scalar,
  ShielderActionSecrets,
  WithdrawPubInputs,
  WithdrawValues
} from "./index";

export interface NewAccountCircuit {
  proveNewAccount(values: NewAccountValues): Promise<Proof>;
  verifyNewAccount(
    proof: Proof,
    pubInputs: NewAccountPubInputs
  ): Promise<boolean>;
}

export interface DepositCircuit {
  proveDeposit(values: DepositValues): Promise<Proof>;
  verifyDeposit(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean>;
}

export interface WithdrawCircuit {
  proveWithdraw(values: WithdrawValues): Promise<Proof>;
  verifyWithdraw(proof: Proof, pubInputs: WithdrawPubInputs): Promise<boolean>;
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
export interface CryptoClient
  extends NewAccountCircuit,
    DepositCircuit,
    WithdrawCircuit,
    Hasher,
    SecretManager,
    Converter,
    NoteTreeConfig {}
