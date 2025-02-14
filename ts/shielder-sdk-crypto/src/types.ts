import { Scalar } from "./scalar";

export type Proof = Uint8Array;

// follows the order in shielder-circuits::circuits::new_account
export type NewAccountPubInputs = {
  hNote: Scalar;
  hId: Scalar;
  initialDeposit: Scalar;
  tokenAddress: Scalar;
  anonymityRevokerPubkey: Scalar;
  symKeyEncryption: Scalar;
};

export type NewAccountAdvice = {
  id: Scalar;
  nullifier: Scalar;
  trapdoor: Scalar;
  initialDeposit: Scalar;
  tokenAddress: Scalar;
  anonymityRevokerPubkey: Scalar; // temporary, will be a curve point in the future
};

// follows the order in shielder-circuits::circuits::deposit
export type DepositPubInputs = {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
  tokenAddress: Scalar;
};

export type DepositAdvice = {
  id: Scalar;
  nonce: Scalar;
  nullifierOld: Scalar;
  trapdoorOld: Scalar;
  accountBalanceOld: Scalar;
  tokenAddress: Scalar;
  path: Uint8Array;
  value: Scalar;
  nullifierNew: Scalar;
  trapdoorNew: Scalar;
};

// follows the order in shielder-circuits::circuits::withdraw
export type WithdrawPubInputs = {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
  tokenAddress: Scalar;
  commitment: Scalar;
};

export type WithdrawAdvice = {
  id: Scalar;
  nonce: Scalar;
  nullifierOld: Scalar;
  trapdoorOld: Scalar;
  accountBalanceOld: Scalar;
  tokenAddress: Scalar;
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
