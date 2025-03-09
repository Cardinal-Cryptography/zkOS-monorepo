import { it, expect, describe, beforeEach, vi } from "vitest";
import { HistoryFetcher } from "../../../src/state/sync/historyFetcher";
import { TokenAccountFinder } from "../../../src/state/sync/tokenAccountFinder";
import { AccountFactory } from "../../../src/state/accountFactory";
import {
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../../../src/state/types";
import { nativeToken } from "../../../src/utils";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";

describe("HistoryFetcher", () => {
  let historyFetcher: HistoryFetcher;
  let mockTokenAccountFinder: TokenAccountFinder;
  let mockChainStateTransition: ChainStateTransition;
  let mockAccountFactory: AccountFactory;
  let mockEmptyState: AccountStateMerkleIndexed;
  // Explicitly type the mock function to avoid TypeScript errors
  let findStateTransitionMock: any;

  beforeEach(() => {
    // Create mock empty state
    mockEmptyState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 0n,
      balance: 0n,
      currentNote: Scalar.fromBigint(0n),
      currentNoteIndex: 0n
    };

    // Create mock AccountFactory
    mockAccountFactory = {
      createEmptyAccountState: vi.fn().mockResolvedValue(mockEmptyState)
    } as unknown as AccountFactory;

    // Create mock TokenAccountFinder
    findTokenByAccountIndexMock = vi.fn().mockResolvedValue(null);
    mockTokenAccountFinder = {
      findTokenByAccountIndex: findTokenByAccountIndexMock
    } as any;

    findStateTransitionMock = vi.fn();
    mockStateTransitionFinder = {
      findStateTransition: findStateTransitionMock
    } as any;

    // Create HistoryFetcher instance
    historyFetcher = new HistoryFetcher(
      mockTokenAccountFinder,
      mockAccountFactory,
      mockStateTransitionFinder
    );
  });

  describe("getTransactionHistorySingleToken", () => {
    it("should yield transactions in order", async () => {
      // Mock state transitions
      const state1: AccountStateMerkleIndexed = {
        ...mockEmptyState,
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(1n),
        currentNoteIndex: 1n
      };

      const state2: AccountStateMerkleIndexed = {
        ...state1,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(2n),
        currentNoteIndex: 2n
      };

      const state3: AccountStateMerkleIndexed = {
        ...state2,
        nonce: 3n,
        balance: 100n,
        currentNote: Scalar.fromBigint(3n),
        currentNoteIndex: 3n
      };

      // Mock transactions
      const tx1: ShielderTransaction = {
        type: "Deposit",
        amount: 100n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      const tx2: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x2",
        block: 2n,
        token: nativeToken()
      };

      const tx3: ShielderTransaction = {
        type: "Withdraw",
        amount: 50n,
        to: "0x1234567890123456789012345678901234567890",
        relayerFee: 1n,
        txHash: "0x3",
        block: 3n,
        token: nativeToken()
      };

      // Setup mock behavior
      findStateTransitionMock
        .mockResolvedValueOnce({ newState: state1, transaction: tx1 })
        .mockResolvedValueOnce({ newState: state2, transaction: tx2 })
        .mockResolvedValueOnce({ newState: state3, transaction: tx3 })
        .mockResolvedValueOnce(null);

      // Call the method and collect results
      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistorySingleToken(
        nativeToken()
      )) {
        transactions.push(tx);
      }

      // Verify results
      expect(transactions).toHaveLength(3);
      expect(transactions[0]).toEqual(tx1);
      expect(transactions[1]).toEqual(tx2);
      expect(transactions[2]).toEqual(tx3);

      // Verify AccountFactory was called correctly
      expect(mockAccountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken()
      );

      // Verify StateTransitionFinder was called correctly
      expect(findStateTransitionMock).toHaveBeenCalledTimes(4);
      expect(findStateTransitionMock).toHaveBeenNthCalledWith(
        1,
        mockEmptyState
      );
      expect(findStateTransitionMock).toHaveBeenNthCalledWith(2, state1);
      expect(findStateTransitionMock).toHaveBeenNthCalledWith(3, state2);
      expect(findStateTransitionMock).toHaveBeenNthCalledWith(4, state3);
    });

    it("should handle empty transaction history", async () => {
      // Setup mock behavior to return null (no state transitions)
      findStateTransitionMock.mockResolvedValue(null);

      // Call the method and collect results
      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistorySingleToken(
        nativeToken()
      )) {
        transactions.push(tx);
      }

      // Verify results
      expect(transactions).toHaveLength(0);

      // Verify AccountFactory was called correctly
      expect(mockAccountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken()
      );

      // Verify StateTransitionFinder was called correctly
      expect(findStateTransitionMock).toHaveBeenCalledTimes(1);
      expect(findStateTransitionMock).toHaveBeenCalledWith(mockEmptyState);
    });

    it("should stop when no more state transitions are found", async () => {
      // Mock state transitions
      const state1: AccountStateMerkleIndexed = {
        ...mockEmptyState,
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(1n),
        currentNoteIndex: 1n
      };

      // Mock transaction
      const tx1: ShielderTransaction = {
        type: "Deposit",
        amount: 100n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      // Setup mock behavior
      findStateTransitionMock
        .mockResolvedValueOnce({ newState: state1, transaction: tx1 })
        .mockResolvedValueOnce(null);

      // Call the method and collect results
      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistorySingleToken(
        nativeToken(),
        0
      )) {
        transactions.push(tx);
      }

      // Verify results
      expect(transactions).toHaveLength(1);
      expect(transactions[0]).toEqual(tx1);

      // Verify StateTransitionFinder was called correctly
      expect(findStateTransitionMock).toHaveBeenCalledTimes(2);
    });

    it("should propagate errors from dependencies", async () => {
      // Setup mock behavior to throw an error
      const testError = new Error("Test error");
      findStateTransitionMock.mockRejectedValue(testError);

      // Call the method and expect it to throw
      const generator = historyFetcher.getTransactionHistorySingleToken(
        nativeToken(),
        0
      );

      await expect(generator.next()).rejects.toThrow(testError);

      // Verify AccountFactory was called correctly
      expect(mockAccountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken(),
        0
      );
    });
  });
});
