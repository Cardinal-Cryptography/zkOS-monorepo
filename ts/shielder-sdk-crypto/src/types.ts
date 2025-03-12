export type Proof = Uint8Array;

// follows the order in shielder-circuits::circuits::new_account
export type NewAccountPubInputs<T> = {
  hNote: T;
  prenullifier: T;
  initialDeposit: T;
  tokenAddress: T;
  anonymityRevokerPublicKeyX: T;
  anonymityRevokerPublicKeyY: T;
  symKeyEncryption1X: T;
  symKeyEncryption1Y: T;
  symKeyEncryption2X: T;
  symKeyEncryption2Y: T;
  macSalt: T;
  macCommitment: T;
};

export type NewAccountAdvice<T> = {
  id: T;
  nullifier: T;
  trapdoor: T;
  initialDeposit: T;
  tokenAddress: T;
  encryptionSalt: T;
  anonymityRevokerPublicKeyX: T;
  anonymityRevokerPublicKeyY: T;
  macSalt: T;
};

// follows the order in shielder-circuits::circuits::deposit
export type DepositPubInputs<T> = {
  merkleRoot: T;
  hNullifierOld: T;
  hNoteNew: T;
  value: T;
  tokenAddress: T;
  macSalt: T;
  macCommitment: T;
};

export type DepositAdvice<T> = {
  id: T;
  nullifierOld: T;
  trapdoorOld: T;
  accountBalanceOld: T;
  tokenAddress: T;
  path: Uint8Array;
  value: T;
  nullifierNew: T;
  trapdoorNew: T;
  macSalt: T;
};

// follows the order in shielder-circuits::circuits::withdraw
export type WithdrawPubInputs<T> = {
  merkleRoot: T;
  hNullifierOld: T;
  hNoteNew: T;
  value: T;
  tokenAddress: T;
  commitment: T;
  macSalt: T;
  macCommitment: T;
};

export type WithdrawAdvice<T> = {
  id: T;
  nullifierOld: T;
  trapdoorOld: T;
  accountBalanceOld: T;
  tokenAddress: T;
  path: Uint8Array;
  value: T;
  nullifierNew: T;
  trapdoorNew: T;
  commitment: T;
  macSalt: T;
};

export type ShielderActionSecrets<T> = {
  nullifier: T;
  trapdoor: T;
};
