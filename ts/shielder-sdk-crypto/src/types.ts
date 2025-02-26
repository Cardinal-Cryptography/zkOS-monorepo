import { Scalar } from "./scalar";

export type Proof = Uint8Array;
export type CurvePointAffine<T> = {
  x: T;
  y: T;
};

// follows the order in shielder-circuits::circuits::new_account
export type NewAccountPubInputs = {
  hNote: Scalar;
  hId: Scalar;
  initialDeposit: Scalar;
  tokenAddress: Scalar;
  anonymityRevokerPubkey: CurvePointAffine<Scalar>;
  symKeyEncryption1X: Scalar;
  symKeyEncryption1Y: Scalar;
  symKeyEncryption2X: Scalar;
  symKeyEncryption2Y: Scalar;
};

export type NewAccountAdvice = {
  id: Scalar;
  nullifier: Scalar;
  trapdoor: Scalar;
  initialDeposit: Scalar;
  tokenAddress: Scalar;
  encryptionSalt: Scalar;
  anonymityRevokerPubkey: CurvePointAffine<Scalar>;
};

// follows the order in shielder-circuits::circuits::deposit
export type DepositPubInputs = {
  idHiding: Scalar;
  merkleRoot: Scalar;
  hNullifierOld: Scalar;
  hNoteNew: Scalar;
  value: Scalar;
  tokenAddress: Scalar;
  macSalt: Scalar;
  macCommitment: Scalar;
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
  macSalt: Scalar;
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
  macSalt: Scalar;
  macCommitment: Scalar;
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
  macSalt: Scalar;
};

export type ShielderActionSecrets = {
  nullifier: Scalar;
  trapdoor: Scalar;
};
