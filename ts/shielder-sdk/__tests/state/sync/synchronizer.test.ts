import { it, expect, describe, beforeEach, vi } from "vitest";
import { StateSynchronizer } from "../../../src/state/sync/synchronizer";
import { StateManager } from "../../../src/state/manager";
import {
  AccountState,
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../../../src/state/types";
import { nativeToken } from "../../../src/utils";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { ChainStateTransition } from "../../../src/state/sync/chainStateTransition";

describe("StateSynchronizer", () => {
  let stateSynchronizer: StateSynchronizer;
  let mockStateManager: StateManager;
  let mockChainStateTransition: ChainStateTransition;
  let mockSyncCallback: (transaction: ShielderTransaction) => unknown;
  let mockState: AccountStateMerkleIndexed;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockAccountState: any;
  let mockUpdateAccountState: any;
  let mockFindStateTransition: any;

  beforeEach(() => {
    mockState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 1n,
      balance: 100n,
      currentNote: Scalar.fromBigint(100n),
      currentNoteIndex: 1n
    };

    mockAccountState = vi.fn().mockResolvedValue(mockState);
    mockUpdateAccountState = vi.fn().mockResolvedValue(undefined);
    mockStateManager = {
      accountState: mockAccountState,
      updateAccountState: mockUpdateAccountState
    } as any;

    mockFindStateTransition = vi.fn();
    mockChainStateTransition = {
      findStateTransition: mockFindStateTransition
    } as any;

    mockSyncCallback = vi.fn();

    stateSynchronizer = new StateSynchronizer(
      mockStateManager,
      mockChainStateTransition,
      mockSyncCallback
    );
  });

  describe("createEmptyAccountState", () => {
    it("should create empty account state when account doesn't exist", async () => {
      mockAccountState.mockResolvedValue(null);

      const emptyState: AccountState = {
        id: Scalar.fromBigint(2n),
        token: nativeToken(),
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n)
      };

      const mockCreateEmptyAccountState = vi.fn().mockResolvedValue(emptyState);
      mockStateManager.createEmptyAccountState = mockCreateEmptyAccountState;

      mockFindStateTransition.mockResolvedValue(null);

      await stateSynchronizer.syncSingleAccount(nativeToken());

      expect(mockCreateEmptyAccountState).toHaveBeenCalledWith(nativeToken());

      expect(mockFindStateTransition).toHaveBeenCalledWith(emptyState);
    });
  });

  describe("syncSingleAccount", () => {
    it("should sync single state transition", async () => {
      const newState: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(200n),
        currentNoteIndex: 2n
      };

      const transaction: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken()
      };

      mockFindStateTransition
        .mockResolvedValueOnce({ newState, transaction })
        .mockResolvedValueOnce(null);

      await stateSynchronizer.syncSingleAccount(nativeToken());

      expect(mockAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockUpdateAccountState).toHaveBeenCalledWith(
        nativeToken(),
        newState
      );

      expect(mockFindStateTransition).toHaveBeenCalledTimes(2);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, mockState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, newState);

      expect(mockSyncCallback).toHaveBeenCalledWith(transaction);
    });

    it("should sync multiple state transitions", async () => {
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

      mockFindStateTransition
        .mockResolvedValueOnce({ newState: state1, transaction: tx1 })
        .mockResolvedValueOnce({ newState: state2, transaction: tx2 })
        .mockResolvedValueOnce(null);

      await stateSynchronizer.syncSingleAccount(nativeToken());

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

      expect(mockFindStateTransition).toHaveBeenCalledTimes(3);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, mockState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, state1);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(3, state2);

      expect(mockSyncCallback).toHaveBeenCalledTimes(2);
      expect(mockSyncCallback).toHaveBeenNthCalledWith(1, tx1);
      expect(mockSyncCallback).toHaveBeenNthCalledWith(2, tx2);
    });
  });
});
