import { Scalar, scalarToBigint, scalarsEqual, isBigintScalar } from "./scalar";
import { CryptoClient } from "@/cryptoClient";

export type Proof = Uint8Array;

export interface NewAccountPubInputs {
  hNote: Scalar;
  hId: Scalar;
  initialDeposit: Scalar;
}

export interface NewAccountValues {
  id: Scalar;
  nullifier: Scalar;
  trapdoor: Scalar;
  initialDeposit: Scalar;
}

export interface DepositPubInputs {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
}

export interface DepositValues {
  id: Scalar;
  nonce: Scalar;
  nullifierOld: Scalar;
  trapdoorOld: Scalar;
  accountBalanceOld: Scalar;
  path: Uint8Array;
  value: Scalar;
  nullifierNew: Scalar;
  trapdoorNew: Scalar;
}

export interface WithdrawPubInputs {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
  commitment: Scalar;
}

export interface WithdrawValues {
  id: Scalar;
  nonce: Scalar;
  nullifierOld: Scalar;
  trapdoorOld: Scalar;
  accountBalanceOld: Scalar;
  path: Uint8Array;
  value: Scalar;
  nullifierNew: Scalar;
  trapdoorNew: Scalar;
  commitment: Scalar;
}

export type ShielderActionSecrets = {
  nullifier: Scalar;
  trapdoor: Scalar;
};

export { Scalar, scalarToBigint, isBigintScalar, scalarsEqual, CryptoClient };
