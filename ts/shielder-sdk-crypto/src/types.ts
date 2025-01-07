import { Scalar } from "./scalar";

export type Proof = Uint8Array;

export type NewAccountPubInputs = {
  hNote: Scalar;
  hId: Scalar;
  initialDeposit: Scalar;
};

export type NewAccountValues = {
  id: Scalar;
  nullifier: Scalar;
  trapdoor: Scalar;
  initialDeposit: Scalar;
};

export type DepositPubInputs = {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
};

export type DepositValues = {
  id: Scalar;
  nonce: Scalar;
  nullifierOld: Scalar;
  trapdoorOld: Scalar;
  accountBalanceOld: Scalar;
  path: Uint8Array;
  value: Scalar;
  nullifierNew: Scalar;
  trapdoorNew: Scalar;
};

export type WithdrawPubInputs = {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
  commitment: Scalar;
};

export type WithdrawValues = {
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
};

export type ShielderActionSecrets = {
  nullifier: Scalar;
  trapdoor: Scalar;
};
