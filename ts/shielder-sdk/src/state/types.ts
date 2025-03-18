import { Token } from "@/types";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { Address, Hex } from "viem";

export type AccountState = {
  /**
   * Account id, a scalar derived from the private key.
   */
  id: Scalar;
  /**
   * Account token
   */
  token: Token;
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
};

export type AccountStateMerkleIndexed = AccountState & {
  /**
   * Merkle tree index of the last note.
   */
  currentNoteIndex: bigint;
};

export type ShielderTransaction = {
  type: "NewAccount" | "Deposit" | "Withdraw";
  amount: bigint;
  to?: Address;
  relayerFee?: bigint;
  txHash: Hex;
  block: bigint;
  token: Token;
  pocketMoney?: bigint;
};
