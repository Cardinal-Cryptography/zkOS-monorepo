import { Calldata } from "@/actions";
import { ShielderTransaction } from "@/state";

export type ShielderOperation = "shield" | "withdraw" | "sync";

export interface ShielderCallbacks {
  /**
   * Fired after the calldata is generated.
   * @param calldata - calldata generated for the operation with some metadata
   * @param {ShielderOperation} operation - operation type
   */
  onCalldataGenerated?: (
    calldata: Calldata,
    operation: ShielderOperation
  ) => unknown;
  /**
   * Fired after the calldata is sent to chain/relayer.
   * @param txHash - transaction hash
   * @param {ShielderOperation} operation - operation type
   */
  onCalldataSent?: (
    txHash: `0x${string}`,
    operation: ShielderOperation
  ) => unknown;
  /**
   * Fired after the new transaction is found and tracked by shielder client.
   * This is the intended way to track the new transactions.
   * Note, that this callback may be called multiple times for the same transaction.
   * @param tx - new transaction
   */
  onNewTransaction?: (tx: ShielderTransaction) => unknown;
  /**
   * Fired when an error occurs during the generation or sending of the calldata, or during syncing.
   */
  onError?: (
    error: unknown,
    stage: "generation" | "sending" | "syncing",
    operation: ShielderOperation
  ) => unknown;
}

export type SendShielderTransaction = (params: {
  data: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
}) => Promise<`0x${string}`>;

export type QuotedFees = {
  // esimated base fee for the withdraw operation
  baseFee: bigint;
  // estimated relay fee for the withdraw operation
  relayFee: bigint;
  // total fee for the withdraw operation, is deducted from the
  // amount to withdraw, supposedly a sum of `baseFee` and `relayFee`
  totalFee: bigint;
};
