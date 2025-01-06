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

export interface CryptoClient {
  proveNewAccount(values: NewAccountValues): Promise<Proof>;

  verifyNewAccount(
    proof: Proof,
    pubInputs: NewAccountPubInputs
  ): Promise<boolean>;

  proveDeposit(values: DepositValues): Promise<Proof>;

  verifyDeposit(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean>;

  proveWithdraw(values: WithdrawValues): Promise<Proof>;

  verifyWithdraw(proof: Proof, pubInputs: WithdrawPubInputs): Promise<boolean>;

  proveAndVerifyMerkle(): Promise<Proof>;

  poseidonHash(inputs: Scalar[]): Promise<Scalar>;

  getSecrets(id: Scalar, nonce: number): Promise<ShielderActionSecrets>;

  privateKeyToScalar(hex: `0x${string}`): Promise<Scalar>;

  treeHeight(): Promise<number>;

  arity(): Promise<number>;
}
