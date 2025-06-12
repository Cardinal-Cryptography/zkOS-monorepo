import { it, expect, describe, beforeEach, vi } from "vitest";
import { StateSynchronizer } from "../../../src/state/sync/synchronizer";
import { AccountRegistry } from "../../../src/state/accountRegistry";
import { TokenAccountFinder } from "../../../src/state/sync/tokenAccountFinder";
import {
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../../../src/state/types";
import { nativeToken } from "../../../src/utils";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { ChainStateTransition } from "../../../src/state/sync/chainStateTransition";

describe("StateSynchronizer", () => {
  let stateSynchronizer: StateSynchronizer;
  let mockAccountRegistry: AccountRegistry;
  let mockTokenAccountFinder: TokenAccountFinder;
  let mockChainStateTransition: ChainStateTransition;
  let mockSyncCallback: (transaction: ShielderTransaction) => unknown;
  let mockState: AccountStateMerkleIndexed;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockGetAccountState: any;
  let mockUpdateAccountState: any;
  let mockGetTokenByAccountIndex: any;
  let mockFindStateTransition: any;
  let mockFindTokenByAccountIndex: any;
  let mockValidateAccountState: any;

  beforeEach(() => {
    mockState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 1n,
      balance: 100n,
      currentNote: Scalar.fromBigint(100n),
      currentNoteIndex: 1n
    };

    mockGetAccountState = vi.fn().mockResolvedValue(mockState);
    mockUpdateAccountState = vi.fn().mockResolvedValue(undefined);
    mockGetTokenByAccountIndex = vi.fn().mockResolvedValue(null);
    mockAccountRegistry = {
      getAccountState: mockGetAccountState,
      updateAccountState: mockUpdateAccountState,
      getTokenByAccountIndex: mockGetTokenByAccountIndex
    } as any;

    mockFindTokenByAccountIndex = vi.fn().mockResolvedValue(null);
    mockTokenAccountFinder = {
      findTokenByAccountIndex: mockFindTokenByAccountIndex
    } as any;

    mockFindStateTransition = vi.fn();
    mockChainStateTransition = {
      findStateTransition: mockFindStateTransition
    } as any;

    mockSyncCallback = vi.fn();
    mockValidateAccountState = vi.fn().mockResolvedValue(undefined);

    stateSynchronizer = new StateSynchronizer(
      mockAccountRegistry,
      mockChainStateTransition,
      mockTokenAccountFinder,
      {
        validateAccountState: mockValidateAccountState
      } as any,
      mockSyncCallback
    );
  });

  let syncSingleAccountSpy: any;

  describe("syncSingleAccount", () => {
    it("should create empty account state when account not found", async () => {
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

      const transaction: ShielderTransaction = {
        type: "Deposit",
        amount: 50n,
        txHash: "0x1",
        block: 1n,
        token: nativeToken(),
        newNote: Scalar.fromBigint(100n)
      };

      mockGetAccountState.mockResolvedValue(null);
      mockAccountRegistry.createEmptyAccountState = vi
        .fn()
        .mockResolvedValue(emptyState);
      mockFindStateTransition
        .mockResolvedValueOnce({ newState, transaction })
        .mockResolvedValueOnce(null);

      await stateSynchronizer.syncSingleAccount(nativeToken());

      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockAccountRegistry.createEmptyAccountState).toHaveBeenCalledWith(
        nativeToken()
      );
      expect(mockUpdateAccountState).toHaveBeenCalledWith(
        nativeToken(),
        newState
      );

      expect(mockFindStateTransition).toHaveBeenCalledTimes(2);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, emptyState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, newState);

      expect(mockSyncCallback).toHaveBeenCalledWith(transaction);

      // validateAccountState should NOT be called when no existing state is found
      expect(mockValidateAccountState).not.toHaveBeenCalled();
    });

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
        token: nativeToken(),
        newNote: Scalar.fromBigint(200n)
      };

      mockFindStateTransition
        .mockResolvedValueOnce({ newState, transaction })
        .mockResolvedValueOnce(null);

      await stateSynchronizer.syncSingleAccount(nativeToken());

      expect(mockGetAccountState).toHaveBeenCalledWith(nativeToken());
      expect(mockUpdateAccountState).toHaveBeenCalledWith(
        nativeToken(),
        newState
      );

      expect(mockFindStateTransition).toHaveBeenCalledTimes(2);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, mockState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, newState);

      expect(mockSyncCallback).toHaveBeenCalledWith(transaction);

      // validateAccountState should be called once with the existing state
      expect(mockValidateAccountState).toHaveBeenCalledTimes(1);
      expect(mockValidateAccountState).toHaveBeenCalledWith(mockState);
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
        token: nativeToken(),
        newNote: Scalar.fromBigint(200n)
      };

      const tx2: ShielderTransaction = {
        type: "Withdraw",
        amount: 50n,
        to: "0x1234567890123456789012345678901234567890",
        relayerFee: 1n,
        txHash: "0x2",
        block: 2n,
        token: nativeToken(),
        newNote: Scalar.fromBigint(300n)
      };

      mockFindStateTransition
        .mockResolvedValueOnce({ newState: state1, transaction: tx1 })
        .mockResolvedValueOnce({ newState: state2, transaction: tx2 })
        .mockResolvedValueOnce(null);

      await stateSynchronizer.syncSingleAccount(nativeToken());

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

      expect(mockFindStateTransition).toHaveBeenCalledTimes(3);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(1, mockState);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(2, state1);
      expect(mockFindStateTransition).toHaveBeenNthCalledWith(3, state2);

      expect(mockSyncCallback).toHaveBeenCalledTimes(2);
      expect(mockSyncCallback).toHaveBeenNthCalledWith(1, tx1);
      expect(mockSyncCallback).toHaveBeenNthCalledWith(2, tx2);

      // validateAccountState should be called once with the existing state
      expect(mockValidateAccountState).toHaveBeenCalledTimes(1);
      expect(mockValidateAccountState).toHaveBeenCalledWith(mockState);
    });
  });

  describe("syncAllAccounts", () => {
    beforeEach(() => {
      syncSingleAccountSpy = vi.spyOn(stateSynchronizer, "syncSingleAccount");
      syncSingleAccountSpy.mockResolvedValue(undefined);
    });

    it("should sync multiple accounts from registry and finder", async () => {
      const token1 = nativeToken();
      const token2 = { type: "erc20", address: "0x1234" as `0x${string}` };
      const token3 = { type: "erc20", address: "0x5678" as `0x${string}` };

      mockGetTokenByAccountIndex
        .mockResolvedValueOnce(token1) // Account index 0 from registry
        .mockResolvedValueOnce(token2) // Account index 1 not in registry
        .mockResolvedValueOnce(null) // Account index 2 from registry
        .mockResolvedValueOnce(null); // Account index 3 not in registry

      mockFindTokenByAccountIndex
        .mockResolvedValueOnce(token3) // Account index 2 (already in registry)
        .mockResolvedValueOnce(null); // Account index 3 not found

      await stateSynchronizer.syncAllAccounts();

      expect(mockGetTokenByAccountIndex).toHaveBeenCalledTimes(4);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(1, 0);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(2, 1);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(3, 2);
      expect(mockGetTokenByAccountIndex).toHaveBeenNthCalledWith(4, 3);

      expect(mockFindTokenByAccountIndex).toHaveBeenCalledTimes(2);
      expect(mockFindTokenByAccountIndex).toHaveBeenNthCalledWith(1, 2);
      expect(mockFindTokenByAccountIndex).toHaveBeenNthCalledWith(2, 3);

      expect(syncSingleAccountSpy).toHaveBeenCalledTimes(3);
      expect(syncSingleAccountSpy).toHaveBeenNthCalledWith(1, token1);
      expect(syncSingleAccountSpy).toHaveBeenNthCalledWith(2, token2);
      expect(syncSingleAccountSpy).toHaveBeenNthCalledWith(3, token3);
    });
  });
});
