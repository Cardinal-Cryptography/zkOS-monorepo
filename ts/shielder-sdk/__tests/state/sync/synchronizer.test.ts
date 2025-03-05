import { it, expect, describe, beforeEach, vi } from "vitest";
import { StateSynchronizer } from "../../../src/state/sync/synchronizer";
import { AccountRegistry } from "../../../src/state/accountRegistry";
import { TokenAccountFinder } from "../../../src/state/sync/tokenAccountFinder";
import { StateTransitionFinder } from "../../../src/state/sync/stateTransitionFinder";
import { Mutex } from "async-mutex";
import {
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../../../src/state/types";
import { nativeToken } from "../../../src/utils";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";

describe("StateSynchronizer", () => {
  let stateSynchronizer: StateSynchronizer;
  let mockAccountRegistry: AccountRegistry;
  let mockTokenAccountFinder: TokenAccountFinder;
  let mockStateTransitionFinder: StateTransitionFinder;
  let mockSyncCallback: (transaction: ShielderTransaction) => unknown;
  let mockSingleTokenMutex: Mutex;
  let mockAllTokensMutex: Mutex;
  let mockState: AccountStateMerkleIndexed;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockGetAccountState: any;
  let mockUpdateAccountState: any;
  let mockGetTokenByAccountIndex: any;
  let mockFindStateTransition: any;
  let mockFindTokenByAccountIndex: any;

  beforeEach(() => {
    // Create mock state
    mockState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 1n,
      balance: 100n,
      currentNote: Scalar.fromBigint(100n),
      currentNoteIndex: 1n
    };

    // Create mock AccountRegistry
    mockGetAccountState = vi.fn().mockResolvedValue(mockState);
    mockUpdateAccountState = vi.fn().mockResolvedValue(undefined);
    mockGetTokenByAccountIndex = vi.fn().mockResolvedValue(null);
    mockAccountRegistry = {
      getAccountState: mockGetAccountState,
      updateAccountState: mockUpdateAccountState,
      getTokenByAccountIndex: mockGetTokenByAccountIndex
    } as any;

    // Create mock TokenAccountFinder
    mockFindTokenByAccountIndex = vi.fn().mockResolvedValue(null);
    mockTokenAccountFinder = {
      findTokenByAccountIndex: mockFindTokenByAccountIndex
    } as any;

    // Create mock StateTransitionFinder
    mockFindStateTransition = vi.fn();
    mockStateTransitionFinder = {
      findStateTransition: mockFindStateTransition
    } as any;

    // Create mock sync callback
    mockSyncCallback = vi.fn();

    // Create mock Mutexes
    const mockRunExclusive = vi
      .fn()
      .mockImplementation((callback) => callback());
    mockSingleTokenMutex = {
      runExclusive: mockRunExclusive
    } as any;

    const mockAllTokensRunExclusive = vi
      .fn()
      .mockImplementation((callback) => callback());
    mockAllTokensMutex = {
      runExclusive: mockAllTokensRunExclusive
    } as any;

    // Create StateSynchronizer instance
    stateSynchronizer = new StateSynchronizer(
      mockAccountRegistry,
      mockStateTransitionFinder,
      mockTokenAccountFinder,
      mockSyncCallback,
      mockSingleTokenMutex,
      mockAllTokensMutex
    );
  });

  // Spy on syncSingleAccount to test syncAllAccounts
  let syncSingleAccountSpy: any;

  describe("syncSingleAccount", () => {
    it("should create empty account state when account not found", async () => {
      // Mock state transitions
      const emptyState: AccountStateMerkleIndexed = {
        id: Scalar.fromBigint(1n),
        token: nativeToken(),
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n),
        currentNoteIndex: 0n
      };

      const newState: AccountStateMerkleIndexed = {
        ...emptyState,
        nonce: 1n,
        balance: 50n,
        currentNote: Scalar.fromBigint(100n),
        currentNoteIndex: 1n
      };

      // Mock transaction
      const transaction: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      // Setup mock behavior
      mockGetAccountState.mockResolvedValue(null);
      mockAccountRegistry.createEmptyAccountState = vi
        .fn()
        .mockResolvedValue(emptyState);
      mockFindStateTransition
        .mockResolvedValueOnce({ newState, transaction })
        .mockResolvedValueOnce(null);

      // Call the method
      await stateSynchronizer.syncSingleAccount(nativeToken());

      // Verify singleTokenMutex was used
      expect(mockSingleTokenMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Verify AccountRegistry was called correctly
      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockAccountRegistry.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken()
      );
      expect(mockUpdateAccountState).toHaveBeenCalledWith(
        nativeToken(),
        newState
      );

      // Verify StateTransitionFinder was called correctly
      expect(mockFindStateTransition).toHaveBeenCalledTimes(2);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, emptyState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, newState);

      // Verify callback was called
      expect(mockSyncCallback).toHaveBeenCalledWith(transaction);
    });

    it("should sync single state transition", async () => {
      // Mock state transitions
      const newState: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(200n),
        currentNoteIndex: 2n
      };

      // Mock transaction
      const transaction: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      // Setup mock behavior
      mockFindStateTransition
        .mockResolvedValueOnce({ newState, transaction })
        .mockResolvedValueOnce(null);

      // Call the method
      await stateSynchronizer.syncSingleAccount(nativeToken());

      // Verify singleTokenMutex was used
      expect(mockSingleTokenMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Verify AccountRegistry was called correctly
      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockUpdateAccountState).toHaveBeenCalledWith(
        nativeToken(),
        newState
      );

      // Verify StateTransitionFinder was called correctly
      expect(mockFindStateTransition).toHaveBeenCalledTimes(2);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, mockState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, newState);

      // Verify callback was called
      expect(mockSyncCallback).toHaveBeenCalledWith(transaction);
    });

    it("should sync multiple state transitions", async () => {
      // Mock state transitions
      const state1: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(200n),
        currentNoteIndex: 2n
      };

      const state2: AccountStateMerkleIndexed = {
        ...state1,
        nonce: 3n,
        balance: 100n,
        currentNote: Scalar.fromBigint(300n),
        currentNoteIndex: 3n
      };

      // Mock transactions
      const tx1: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      const tx2: ShielderTransaction = {
        type: "Withdraw",
        amount: 50n,
        to: "0x1234567890123456789012345678901234567890",
        relayerFee: 1n,
        txHash: "0x2",
        block: 2n,
        token: nativeToken()
      };

      // Setup mock behavior
      mockFindStateTransition
        .mockResolvedValueOnce({ newState: state1, transaction: tx1 })
        .mockResolvedValueOnce({ newState: state2, transaction: tx2 })
        .mockResolvedValueOnce(null);

      // Call the method
      await stateSynchronizer.syncSingleAccount(nativeToken());

      // Verify singleTokenMutex was used
      expect(mockSingleTokenMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Verify AccountRegistry was called correctly
      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockUpdateAccountState).toHaveBeenCalledTimes(2);
      expect(mockUpdateAccountState).toHaveBeenNthCalledWith(
        1,
        nativeToken(),
        state1
      );
      expect(mockUpdateAccountState).toHaveBeenNthCalledWith(
        2,
        nativeToken(),
        state2
      );

      // Verify StateTransitionFinder was called correctly
      expect(mockFindStateTransition).toHaveBeenCalledTimes(3);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, mockState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, state1);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(3, state2);

      // Verify callback was called
      expect(mockSyncCallback).toHaveBeenCalledTimes(2);
      expect(mockSyncCallback).toHaveBeenNthCalledWith(1, tx1);
      expect(mockSyncCallback).toHaveBeenNthCalledWith(2, tx2);
    });

    it("should stop when no more state transitions are found", async () => {
      // Setup mock behavior to return null (no state transitions)
      mockFindStateTransition.mockResolvedValue(null);

      // Call the method
      await stateSynchronizer.syncSingleAccount(nativeToken());

      // Verify singleTokenMutex was used
      expect(mockSingleTokenMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Verify AccountRegistry was called correctly
      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockUpdateAccountState).not.toHaveBeenCalled();

      // Verify StateTransitionFinder was called correctly
      expect(mockFindStateTransition).toHaveBeenCalledTimes(1);
      expect(mockFindStateTransition).toHaveBeenCalledWith(mockState);

      // Verify callback was not called
      expect(mockSyncCallback).not.toHaveBeenCalled();
    });

    it("should not call callback if not provided", async () => {
      // Create StateSynchronizer without callback
      stateSynchronizer = new StateSynchronizer(
        mockAccountRegistry,
        mockStateTransitionFinder,
        mockTokenAccountFinder,
        undefined,
        mockSingleTokenMutex
      );

      // Mock state transitions
      const newState: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(200n),
        currentNoteIndex: 2n
      };

      // Mock transaction
      const transaction: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      // Setup mock behavior
      mockFindStateTransition
        .mockResolvedValueOnce({ newState, transaction })
        .mockResolvedValueOnce(null);

      // Call the method
      await stateSynchronizer.syncSingleAccount(nativeToken());

      // Verify callback was not called
      expect(mockSyncCallback).not.toHaveBeenCalled();

      // Verify other methods were called correctly
      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockUpdateAccountState).toHaveBeenCalledWith(
        nativeToken(),
        newState
      );
    });

    it("should use mutex for concurrency control", async () => {
      // Mock state transitions
      mockFindStateTransition.mockResolvedValue(null);

      // Call the method
      await stateSynchronizer.syncSingleAccount(nativeToken());

      // Verify singleTokenMutex was used
      expect(mockSingleTokenMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Call the method
      await stateSynchronizer.syncAllAccounts();

      // Verify allTokenMutex was used
      expect(mockAllTokensMutex.runExclusive).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors from dependencies", async () => {
      // Setup mock behavior to throw an error
      const testError = new Error("Test error");
      mockFindStateTransition.mockRejectedValue(testError);

      // Call the method and expect it to throw
      await expect(
        stateSynchronizer.syncSingleAccount(nativeToken())
      ).rejects.toThrow(testError);

      // Verify allTokensMutex was used
      expect(mockSingleTokenMutex.runExclusive).toHaveBeenCalledTimes(1);
    });

    it("should create default mutex if not provided", () => {
      // Create StateSynchronizer without mutex
      const syncWithoutMutex = new StateSynchronizer(
        mockAccountRegistry,
        mockStateTransitionFinder,
        mockTokenAccountFinder,
        mockSyncCallback
      );

      // Verify that a mutex was created (indirectly by checking the constructor was called)
      expect(syncWithoutMutex).toBeInstanceOf(StateSynchronizer);
    });
  });

  describe("syncAllAccounts", () => {
    beforeEach(() => {
      // Create a spy on syncSingleAccount
      syncSingleAccountSpy = vi.spyOn(stateSynchronizer, "syncSingleAccount");
      // Mock implementation to avoid actual calls
      syncSingleAccountSpy.mockResolvedValue(undefined);
    });

    it("should sync multiple accounts from registry and finder", async () => {
      // Mock tokens for different account indices
      const token1 = nativeToken();
      const token2 = { type: "erc20", address: "0x1234" as `0x${string}` };
      const token3 = { type: "erc20", address: "0x5678" as `0x${string}` };

      // Setup mock behavior for getTokenByAccountIndex
      mockGetTokenByAccountIndex
        .mockResolvedValueOnce(token1) // Account index 0 from registry
        .mockResolvedValueOnce(token2) // Account index 1 not in registry
        .mockResolvedValueOnce(null) // Account index 2 from registry
        .mockResolvedValueOnce(null); // Account index 3 not in registry

      // Setup mock behavior for findTokenByAccountIndex
      mockFindTokenByAccountIndex
        .mockResolvedValueOnce(token3) // Account index 2 (already in registry)
        .mockResolvedValueOnce(null); // Account index 3 not found

      // Call the method
      await stateSynchronizer.syncAllAccounts();

      // Verify mutex was used
      expect(mockAllTokensMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Verify getTokenByAccountIndex was called correctly
      expect(mockGetTokenByAccountIndex).toHaveBeenCalledTimes(4);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(1, 0);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(2, 1);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(3, 2);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(4, 3);

      // Verify findTokenByAccountIndex was called correctly
      expect(mockFindTokenByAccountIndex).toHaveBeenCalledTimes(2);
      expect(mockFindTokenByAccountIndex).toHaveBeenNthCalledWith(1, 2);
      expect(mockFindTokenByAccountIndex).toHaveBeenNthCalledWith(2, 3);

      // Verify syncSingleAccount was called correctly
      expect(syncSingleAccountSpy).toHaveBeenCalledTimes(3);
      expect(syncSingleAccountSpy).toHaveBeenNthCalledWith(1, token1);
      expect(syncSingleAccountSpy).toHaveBeenNthCalledWith(2, token2);
      expect(syncSingleAccountSpy).toHaveBeenNthCalledWith(3, token3);
    });

    it("should handle no accounts", async () => {
      // Setup mock behavior for both methods to return null (no accounts)
      mockGetTokenByAccountIndex.mockResolvedValue(null);
      mockFindTokenByAccountIndex.mockResolvedValue(null);

      // Call the method
      await stateSynchronizer.syncAllAccounts();

      // Verify mutex was used
      expect(mockAllTokensMutex.runExclusive).toHaveBeenCalledTimes(1);

      // Verify getTokenByAccountIndex was called correctly
      expect(mockGetTokenByAccountIndex).toHaveBeenCalledTimes(1);
      expect(mockGetTokenByAccountIndex).toHaveBeenCalledWith(0);

      // Verify findTokenByAccountIndex was called correctly
      expect(mockFindTokenByAccountIndex).toHaveBeenCalledTimes(1);
      expect(mockFindTokenByAccountIndex).toHaveBeenCalledWith(0);

      // Verify syncSingleAccount was not called
      expect(syncSingleAccountSpy).not.toHaveBeenCalled();
    });

    it("should use allTokensMutex for concurrency control", async () => {
      // Setup mock behavior for both methods to return null (no accounts)
      mockGetTokenByAccountIndex.mockResolvedValue(null);
      mockFindTokenByAccountIndex.mockResolvedValue(null);

      // Call the method
      await stateSynchronizer.syncAllAccounts();

      // Verify allTokensMutex was used
      expect(mockAllTokensMutex.runExclusive).toHaveBeenCalledTimes(1);
      // Verify singleTokenMutex was not used directly (it's used inside syncSingleAccount)
      expect(mockSingleTokenMutex.runExclusive).not.toHaveBeenCalled();
    });

    it("should propagate errors from dependencies", async () => {
      // Setup mock behavior to throw an error
      const testError = new Error("Test error");
      mockGetTokenByAccountIndex.mockRejectedValue(testError);

      // Call the method and expect it to throw
      await expect(stateSynchronizer.syncAllAccounts()).rejects.toThrow(
        testError
      );

      // Verify allTokensMutex was used
      expect(mockAllTokensMutex.runExclusive).toHaveBeenCalledTimes(1);
    });

    it("should create default allTokensMutex if not provided", () => {
      // Create StateSynchronizer without allTokensMutex (only singleTokenMutex)
      const syncWithoutAllTokensMutex = new StateSynchronizer(
        mockAccountRegistry,
        mockStateTransitionFinder,
        mockTokenAccountFinder,
        mockSyncCallback,
        mockSingleTokenMutex
      );

      // Verify that a mutex was created (indirectly by checking the constructor was called)
      expect(syncWithoutAllTokensMutex).toBeInstanceOf(StateSynchronizer);
    });
  });
});
