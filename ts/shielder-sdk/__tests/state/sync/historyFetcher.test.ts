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
import { ChainStateTransition } from "../../../src/state/sync/chainStateTransition";

describe("HistoryFetcher", () => {
  let historyFetcher: HistoryFetcher;
  let mockTokenAccountFinder: TokenAccountFinder;
  let mockChainStateTransition: ChainStateTransition;
  let mockAccountFactory: AccountFactory;
  let mockEmptyState: AccountStateMerkleIndexed;
  // Explicitly type the mock function to avoid TypeScript errors
  let findStateTransitionMock: any;
  let findTokenByAccountIndexMock: any;

  beforeEach(() => {
    mockEmptyState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 0n,
      balance: 0n,
      currentNote: Scalar.fromBigint(0n),
      currentNoteIndex: 0n
    };

    mockAccountFactory = {
      createEmptyAccountState: vi.fn().mockResolvedValue(mockEmptyState)
    } as unknown as AccountFactory;

    findTokenByAccountIndexMock = vi.fn().mockResolvedValue(null);
    mockTokenAccountFinder = {
      findTokenByAccountIndex: findTokenByAccountIndexMock
    } as any;

    findStateTransitionMock = vi.fn();
    mockChainStateTransition = {
      findStateTransition: findStateTransitionMock
    } as any;

    historyFetcher = new HistoryFetcher(
      mockTokenAccountFinder,
      mockAccountFactory,
      mockChainStateTransition
    );
  });

  describe("getTransactionHistorySingleToken", () => {
    it("should yield transactions in order", async () => {
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

      findStateTransitionMock
        .mockResolvedValueOnce({ newState: state1, transaction: tx1 })
        .mockResolvedValueOnce({ newState: state2, transaction: tx2 })
        .mockResolvedValueOnce({ newState: state3, transaction: tx3 })
        .mockResolvedValueOnce(null);

      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistorySingleToken(
        nativeToken(),
        0
      )) {
        transactions.push(tx);
      }

      expect(transactions).toHaveLength(3);
      expect(transactions[0]).toEqual(tx1);
      expect(transactions[1]).toEqual(tx2);
      expect(transactions[2]).toEqual(tx3);

      expect(mockAccountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken(),
        0
      );

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
      findStateTransitionMock.mockResolvedValue(null);

      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistorySingleToken(
        nativeToken(),
        0
      )) {
        transactions.push(tx);
      }

      expect(transactions).toHaveLength(0);

      expect(mockAccountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken(),
        0
      );

      expect(findStateTransitionMock).toHaveBeenCalledTimes(1);
      expect(findStateTransitionMock).toHaveBeenCalledWith(mockEmptyState);
    });
  });
});
