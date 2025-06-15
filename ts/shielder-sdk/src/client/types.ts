import { Calldata } from "@/actions/types";
import { ShielderTransaction } from "@/state/types";

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
   * Fired when the current shielder state is broken. Usually this means that the chain
   * has been reorganized and the shielder state is no longer valid.
   * The client should be re-initialized to recover from this state.
   */
  onAccountNotOnChain: (
    error: unknown,
    stage: "generation" | "sending" | "syncing",
    operation: ShielderOperation
  ) => unknown;
  /**
   * Fired when the SDK version is outdated and cannot be used for the operation.
   */
  onSdkOutdated: (
    error: unknown,
    stage: "generation" | "sending" | "syncing",
    operation: ShielderOperation
  ) => unknown;
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
  gas: bigint;
}) => Promise<`0x${string}`>;
