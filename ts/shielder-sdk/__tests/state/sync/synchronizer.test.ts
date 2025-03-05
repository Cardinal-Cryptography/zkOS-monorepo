import { it, expect, describe, beforeEach, vi } from "vitest";
import { StateSynchronizer } from "../../../src/state/sync/synchronizer";
import { StateManager } from "../../../src/state/manager";
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
  let mockStateManager: StateManager;
  let mockStateTransitionFinder: StateTransitionFinder;
  let mockSyncCallback: (transaction: ShielderTransaction) => unknown;
  let mockMutex: Mutex;
  let mockState: AccountStateMerkleIndexed;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockAccountState: any;
  let mockUpdateAccountState: any;
  let mockFindStateTransition: any;
  let mockRunExclusive: any;

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

    // Create mock StateManager
    mockAccountState = vi.fn().mockResolvedValue(mockState);
    mockUpdateAccountState = vi.fn().mockResolvedValue(undefined);
    mockStateManager = {
      accountState: mockAccountState,
      updateAccountState: mockUpdateAccountState
    } as any;

    // Create mock StateTransitionFinder
    mockFindStateTransition = vi.fn();
    mockStateTransitionFinder = {
      findStateTransition: mockFindStateTransition
    } as any;

    // Create mock sync callback
    mockSyncCallback = vi.fn();

    // Create mock Mutex
    mockRunExclusive = vi.fn().mockImplementation((callback) => callback());
    mockMutex = {
      runExclusive: mockRunExclusive
    } as any;

    // Create StateSynchronizer instance
    stateSynchronizer = new StateSynchronizer(
      mockStateManager,
      mockStateTransitionFinder,
      mockSyncCallback,
      mockMutex
    );
  });

  describe("syncSingleAccount", () => {
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

      // Verify mutex was used
      expect(mockRunExclusive).toHaveBeenCalledTimes(1);

      // Verify StateManager was called correctly
      expect(mockAccountState).toHaveBeenCalledWith(nativeToken());
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

      // Verify mutex was used
      expect(mockRunExclusive).toHaveBeenCalledTimes(1);

      // Verify StateManager was called correctly
      expect(mockAccountState).toHaveBeenCalledWith(nativeToken());
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

      // Verify mutex was used
      expect(mockRunExclusive).toHaveBeenCalledTimes(1);

      // Verify StateManager was called correctly
      expect(mockAccountState).toHaveBeenCalledWith(nativeToken());
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
        mockStateManager,
        mockStateTransitionFinder,
        undefined,
        mockMutex
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
      expect(mockAccountState).toHaveBeenCalledWith(nativeToken());
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

      // Verify mutex was used
      expect(mockRunExclusive).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors from dependencies", async () => {
      // Setup mock behavior to throw an error
      const testError = new Error("Test error");
      mockFindStateTransition.mockRejectedValue(testError);

      // Call the method and expect it to throw
      await expect(
        stateSynchronizer.syncSingleAccount(nativeToken())
      ).rejects.toThrow(testError);

      // Verify mutex was used
      expect(mockRunExclusive).toHaveBeenCalledTimes(1);
    });

    it("should create default mutex if not provided", () => {
      // Create StateSynchronizer without mutex
      const syncWithoutMutex = new StateSynchronizer(
        mockStateManager,
        mockStateTransitionFinder,
        mockSyncCallback
      );

      // Verify that a mutex was created (indirectly by checking the constructor was called)
      expect(syncWithoutMutex).toBeInstanceOf(StateSynchronizer);
    });
  });
});
