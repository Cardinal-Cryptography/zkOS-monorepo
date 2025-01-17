import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { Address, Hex } from "viem";

export type AccountState = {
  /**
   * Account id, a scalar derived from the private key.
   */
  id: Scalar;
  /**
   * Account nonce, increments for each new action.
   */
  nonce: bigint;
  /**
   * Account balance, in wei.
   */
  balance: bigint;
  /**
   * Hash of the last note.
   */
  currentNote: Scalar;
  /**
   * Merkle tree index of the last note.
   */
  currentNoteIndex?: bigint;
  /**
   * Version of the storage schema.
   */
  storageSchemaVersion: number;
};

export type ShielderTransaction = {
  type: "NewAccountNative" | "DepositNative" | "WithdrawNative";
  amount: bigint;
  to?: Address;
  txHash: Hex;
  block: bigint;
};
