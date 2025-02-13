import { describe, it, expect, vitest, beforeEach, Mock, Mocked } from "vitest";
import {
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { IContract, NoteEvent } from "../../src/chain/contract";
import { StateEventsFilter } from "../../src/state/events";
import { StateManager } from "../../src/state/manager";
import { AccountState, ShielderTransaction } from "../../src/state/types";
import {
  StateSynchronizer,
  UnexpectedVersionInEvent
} from "../../src/state/sync";
import { MockedCryptoClient } from "../helpers";
import { Address } from "viem";
import { nativeTokenAddress } from "../../src/constants";

// Test helpers
const createAccountState = (
  id: bigint = 1n,
  nonce: bigint = 0n,
  balance: bigint = 0n,
  currentNote: bigint = 0n,
  storageSchemaVersion: number = 1
): AccountState => ({
  id: Scalar.fromBigint(id),
  nonce,
  balance,
  currentNote: Scalar.fromBigint(currentNote),
  storageSchemaVersion
});

const createNoteEvent = (
  name: "NewAccountNative" | "DepositNative" | "WithdrawNative",
  amount: bigint,
  to: `0x${string}` | undefined,
  block: bigint,
  newNote: bigint,
  contractVersion: `0x${string}` = "0x000001",
  txHash: `0x${string}` = "0xabc"
): NoteEvent => ({
  name,
  amount,
  ...(to && { to }),
  txHash,
  block,
  contractVersion,
  newNoteIndex: newNote,
  newNote
});
// Mock implementations
class MockContract {
  private events: Map<bigint, NoteEvent> = new Map();
  private nullifierToBlock: Map<bigint, bigint | null> = new Map();

  setNoteEvent(block: bigint, event: NoteEvent) {
    this.events.set(block, event);
  }

  setNullifierBlock(nullifierHash: bigint, block: bigint | null) {
    this.nullifierToBlock.set(nullifierHash, block);
  }

  async getNoteEventsFromBlock(block: bigint): Promise<NoteEvent[]> {
    const event = this.events.get(block);
    return event ? [event] : [];
  }

  async nullifierBlock(nullifierHash: bigint): Promise<bigint | null> {
    return this.nullifierToBlock.get(nullifierHash) ?? null;
  }
}

class MockStateEventsFilter {
  stateChangingEvents = async (
    state: AccountState,
    events: NoteEvent[]
  ): Promise<NoteEvent[]> => {
    return events;
  };

  newStateByEvent = async (
    state: AccountState,
    event: NoteEvent
  ): Promise<AccountState | null> => {
    return null;
  };
}

describe("StateSynchronizer", () => {
  let cryptoClient: MockedCryptoClient;
  let contract: MockContract;
  let stateManager: StateManager;
  let stateEventsFilter: MockStateEventsFilter;
  let synchronizer: StateSynchronizer;
  let syncCallback: Mock;

  const setupTestEnvironment = () => {
    const cryptoClient = new MockedCryptoClient();
    const contract = new MockContract();
    const stateManager = new StateManager(
      "0x123" as `0x${string}`,
      {} as any,
      cryptoClient
    ) as Mocked<StateManager>;

    const defaultState = createAccountState();

    vitest.spyOn(stateManager, "accountState").mockResolvedValue(defaultState);
    vitest
      .spyOn(stateManager, "emptyAccountState")
      .mockResolvedValue(defaultState);
    vitest
      .spyOn(stateManager, "updateAccountState")
      .mockResolvedValue(undefined);

    const stateEventsFilter = new MockStateEventsFilter();
    const syncCallback = vitest.fn();
    const synchronizer = new StateSynchronizer(
      stateManager,
      contract as unknown as IContract,
      cryptoClient,
      stateEventsFilter as unknown as StateEventsFilter,
      syncCallback
    );

    return {
      cryptoClient,
      contract,
      stateManager,
      stateEventsFilter,
      syncCallback,
      synchronizer,
      defaultState
    };
  };

  beforeEach(() => {
    const env = setupTestEnvironment();
    cryptoClient = env.cryptoClient;
    contract = env.contract;
    stateManager = env.stateManager;
    stateEventsFilter = env.stateEventsFilter;
    syncCallback = env.syncCallback;
    synchronizer = env.synchronizer;
  });

  describe("syncAccountState", () => {
    it("should sync single state transition", async () => {
      const initialState = createAccountState();
      const newState = createAccountState(1n, 1n, 100n, 1n);
      const event = createNoteEvent("DepositNative", 100n, "0x123", 1n, 1n);

      // Setup mocks
      vitest
        .spyOn(stateManager, "accountState")
        .mockResolvedValue(initialState);
      vitest
        .spyOn(stateEventsFilter, "newStateByEvent")
        .mockResolvedValue(newState);
      contract.setNoteEvent(1n, event);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(
          await cryptoClient.hasher.poseidonHash([initialState.id])
        ),
        1n
      ); // Initial nullifier hash -> block 1

      await synchronizer.syncAccountState(nativeTokenAddress);

      expect(stateManager.updateAccountState).toHaveBeenCalledWith(
        nativeTokenAddress,
        newState
      );
      expect(syncCallback).toHaveBeenCalledWith({
        type: "DepositNative",
        amount: 100n,
        to: "0x123",
        txHash: "0xabc",
        block: 1n
      });
    });

    it("should handle multiple state transitions", async () => {
      const states = [
        createAccountState(),
        createAccountState(1n, 1n, 100n, 1n),
        createAccountState(1n, 2n, 50n, 2n)
      ];
      const events = [
        createNoteEvent("DepositNative", 100n, "0x123", 1n, 1n),
        createNoteEvent(
          "WithdrawNative",
          50n,
          "0x456",
          2n,
          2n,
          "0x000001",
          "0xdef"
        )
      ];

      // Setup mocks
      vitest.spyOn(stateManager, "accountState").mockResolvedValue(states[0]);
      contract.setNoteEvent(1n, events[0]);
      contract.setNoteEvent(2n, events[1]);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(await cryptoClient.hasher.poseidonHash([states[0].id])),
        1n
      ); // Initial nullifier hash -> block 1
      contract.setNullifierBlock(
        scalarToBigint(
          await cryptoClient.hasher.poseidonHash([
            await cryptoClient.secretManager
              .getSecrets(states[0].id, 0)
              .then((secrets) => secrets.nullifier)
          ])
        ),
        2n
      ); // Second nullifier hash -> block 2

      vitest
        .spyOn(stateEventsFilter, "newStateByEvent")
        .mockResolvedValueOnce(states[1])
        .mockResolvedValueOnce(states[2]);

      await synchronizer.syncAccountState(nativeTokenAddress);

      expect(stateManager.updateAccountState).toHaveBeenCalledTimes(2);
      expect(syncCallback).toHaveBeenCalledTimes(2);
      expect(syncCallback).toHaveBeenNthCalledWith(1, {
        type: "DepositNative",
        amount: 100n,
        to: "0x123",
        txHash: "0xabc",
        block: 1n
      });
      expect(syncCallback).toHaveBeenNthCalledWith(2, {
        type: "WithdrawNative",
        amount: 50n,
        to: "0x456",
        txHash: "0xdef",
        block: 2n
      });
    });

    it("should throw on unsupported contract version", async () => {
      const state = createAccountState();
      const event = createNoteEvent(
        "DepositNative",
        100n,
        "0x123",
        1n,
        1n,
        "0x000002"
      ); // Unsupported version

      vitest.spyOn(stateManager, "accountState").mockResolvedValue(state);
      contract.setNoteEvent(1n, event);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(await cryptoClient.hasher.poseidonHash([state.id])),
        1n
      );

      await expect(
        synchronizer.syncAccountState(nativeTokenAddress)
      ).rejects.toThrow(UnexpectedVersionInEvent);
    });

    it("should throw on found, but non-transitioning event", async () => {
      const state = createAccountState();
      const event = createNoteEvent("DepositNative", 100n, "0x123", 1n, 1n);

      // Setup mocks
      vitest.spyOn(stateManager, "accountState").mockResolvedValue(state);
      vitest
        .spyOn(stateEventsFilter, "newStateByEvent")
        .mockResolvedValue(null);
      contract.setNoteEvent(1n, event);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(await cryptoClient.hasher.poseidonHash([state.id])),
        1n
      ); // Initial nullifier hash -> block 1

      await expect(
        synchronizer.syncAccountState(nativeTokenAddress)
      ).rejects.toThrow("State is null, this should not happen");
    });

    it("should throw on non-single filtered events", async () => {
      const state = createAccountState();

      // Setup mocks
      vitest.spyOn(stateManager, "accountState").mockResolvedValue(state);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(await cryptoClient.hasher.poseidonHash([state.id])),
        1n
      ); // Initial nullifier hash -> block 1

      await expect(
        synchronizer.syncAccountState(nativeTokenAddress)
      ).rejects.toThrow("Unexpected number of events: 0, expected 1 event");
    });
  });

  describe("getShielderTransactions", () => {
    it("should yield all transactions", async () => {
      const states = [
        createAccountState(),
        createAccountState(1n, 1n, 100n, 1n),
        createAccountState(1n, 2n, 50n, 2n)
      ];
      const events = [
        createNoteEvent("DepositNative", 100n, "0x123", 1n, 1n),
        createNoteEvent(
          "WithdrawNative",
          50n,
          "0x456",
          2n,
          2n,
          "0x000001",
          "0xdef"
        )
      ];

      // Setup mocks
      vitest.spyOn(stateManager, "accountState").mockResolvedValue(states[0]);
      contract.setNoteEvent(1n, events[0]);
      contract.setNoteEvent(2n, events[1]);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(await cryptoClient.hasher.poseidonHash([states[0].id])),
        1n
      ); // Initial nullifier hash -> block 1
      contract.setNullifierBlock(
        scalarToBigint(
          await cryptoClient.hasher.poseidonHash([
            await cryptoClient.secretManager
              .getSecrets(states[0].id, 0)
              .then((secrets) => secrets.nullifier)
          ])
        ),
        2n
      ); // Second nullifier hash -> block 2

      vitest
        .spyOn(stateEventsFilter, "newStateByEvent")
        .mockResolvedValueOnce(states[1])
        .mockResolvedValueOnce(states[2]);

      const transactions: ShielderTransaction[] = [];
      for await (const tx of synchronizer.getShielderTransactions(
        nativeTokenAddress
      )) {
        transactions.push(tx);
      }
      expect(transactions).toHaveLength(2);
      expect(transactions[0]).toEqual({
        type: "DepositNative",
        amount: 100n,
        to: "0x123",
        txHash: "0xabc",
        block: 1n
      });
      expect(transactions[1]).toEqual({
        type: "WithdrawNative",
        amount: 50n,
        to: "0x456",
        txHash: "0xdef",
        block: 2n
      });
    });

    it("should handle empty transaction history", async () => {
      const emptyState = createAccountState();
      vitest
        .spyOn(stateManager, "emptyAccountState")
        .mockResolvedValue(emptyState);
      contract.setNullifierBlock(1n, null); // No transactions
      const transactions: ShielderTransaction[] = [];
      for await (const tx of synchronizer.getShielderTransactions(
        nativeTokenAddress
      )) {
        transactions.push(tx);
      }
      expect(transactions).toHaveLength(0);
    });

    it("should throw on found, but non-transitioning event", async () => {
      const state = createAccountState();
      const event = createNoteEvent("DepositNative", 100n, "0x123", 1n, 1n);

      // Setup mocks
      vitest.spyOn(stateManager, "accountState").mockResolvedValue(state);
      vitest
        .spyOn(stateEventsFilter, "newStateByEvent")
        .mockResolvedValue(null);
      contract.setNoteEvent(1n, event);
      contract.setNullifierBlock(
        // first nullifier is actually id
        scalarToBigint(await cryptoClient.hasher.poseidonHash([state.id])),
        1n
      ); // Initial nullifier hash -> block 1

      // Should throw on first iteration
      await expect(
        synchronizer.getShielderTransactions(nativeTokenAddress).next()
      ).rejects.toThrow("State is null, this should not happen");
    });
  });
});
