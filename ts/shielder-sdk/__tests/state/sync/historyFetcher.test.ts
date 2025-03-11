import { it, expect, describe, beforeEach, vi } from "vitest";
import { HistoryFetcher } from "../../../src/state/sync/historyFetcher";
import { TokenAccountFinder } from "../../../src/state/sync/tokenAccountFinder";
import { AccountFactory } from "../../../src/state/accountFactory";
import {
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../../../src/state/types";
import { erc20Token, nativeToken } from "../../../src/utils";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { ChainStateTransition } from "../../../src/state/sync/chainStateTransition";

const testErc20Address = "0x1111111111111111111111111111111111111111";

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

  describe("getTransactionHistory", () => {
    it("should yield transactions from multiple tokens", async () => {
      // Set up tokens for different account indices
      findTokenByAccountIndexMock
        .mockResolvedValueOnce(nativeToken()) // Account index 0 -> native token
        .mockResolvedValueOnce(erc20Token(testErc20Address)) // Account index 1 -> custom token
        .mockResolvedValueOnce(null); // No more tokens after index 1

      // Mock empty states for different tokens
      const nativeEmptyState = { ...mockEmptyState, token: nativeToken() };
      const customEmptyState = {
        ...mockEmptyState,
        token: erc20Token(testErc20Address)
      };

      // Reset the mock and implement a custom behavior
      mockAccountFactory.createEmptyAccountState = vi
        .fn()
        .mockImplementation((token, accountIndex) => {
          if (accountIndex === 0) {
            return Promise.resolve(nativeEmptyState);
          } else if (accountIndex === 1) {
            return Promise.resolve(customEmptyState);
          }
          return Promise.resolve(mockEmptyState);
        });

      // Mock state transitions for native token
      const nativeState1: AccountStateMerkleIndexed = {
        ...nativeEmptyState,
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(1n),
        currentNoteIndex: 1n
      };

      // Mock state transitions for custom token
      const customState1: AccountStateMerkleIndexed = {
        ...customEmptyState,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(10n),
        currentNoteIndex: 10n
      };

      // Mock transactions
      const nativeTx: ShielderTransaction = {
        type: "Deposit",
        amount: 100n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      const customTx: ShielderTransaction = {
        type: "Deposit",
        amount: 200n,
        txHash: "0x2",
        block: 2n,
        token: erc20Token(testErc20Address)
      };

      // Set up state transition mock to return different results based on input state
      findStateTransitionMock.mockImplementation((state) => {
        if (state === nativeEmptyState) {
          return Promise.resolve({
            newState: nativeState1,
            transaction: nativeTx
          });
        } else if (state === nativeState1) {
          return Promise.resolve(null); // No more transitions for native token
        } else if (state === customEmptyState) {
          return Promise.resolve({
            newState: customState1,
            transaction: customTx
          });
        } else if (state === customState1) {
          return Promise.resolve(null); // No more transitions for custom token
        }
        return Promise.resolve(null);
      });

      // Collect all transactions from the generator
      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistory()) {
        transactions.push(tx);
      }

      // Verify results
      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toEqual(nativeTx);
      expect(transactions[1]).toEqual(customTx);

      // Verify that findTokenByAccountIndex was called with the correct indices
      expect(findTokenByAccountIndexMock).toHaveBeenCalledTimes(3);
      expect(findTokenByAccountIndexMock).toHaveBeenNthCalledWith(1, 0);
      expect(findTokenByAccountIndexMock).toHaveBeenNthCalledWith(2, 1);
      expect(findTokenByAccountIndexMock).toHaveBeenNthCalledWith(3, 2);

      // Verify that createEmptyAccountState was called with the correct tokens and indices
      expect(mockAccountFactory.createEmptyAccountState).toHaveBeenCalledTimes(
        2
      );
      expect(
        mockAccountFactory.createEmptyAccountState
      ).toHaveBeenNthCalledWith(1, nativeToken(), 0);
      expect(
        mockAccountFactory.createEmptyAccountState
      ).toHaveBeenNthCalledWith(2, erc20Token(testErc20Address), 1);
    });

    it("should handle no tokens case", async () => {
      // Mock no tokens available
      findTokenByAccountIndexMock.mockResolvedValue(null);

      // Collect all transactions from the generator
      const transactions: ShielderTransaction[] = [];
      for await (const tx of historyFetcher.getTransactionHistory()) {
        transactions.push(tx);
      }

      // Verify results
      expect(transactions).toHaveLength(0);

      // Verify that findTokenByAccountIndex was called once with index 0
      expect(findTokenByAccountIndexMock).toHaveBeenCalledTimes(1);
      expect(findTokenByAccountIndexMock).toHaveBeenCalledWith(0);

      // Verify that createEmptyAccountState was not called
      expect(mockAccountFactory.createEmptyAccountState).not.toHaveBeenCalled();
    });
  });
});
