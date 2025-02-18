import { it, expect, describe, beforeEach } from "vitest";
import { StateManager } from "../../src/state/manager";
import { MockedCryptoClient } from "../helpers";
import { StorageInterface } from "../../src/state/storageSchema";
import { AccountState } from "../../src/state/types";
import { nativeTokenAddress, storageSchemaVersion } from "../../src/constants";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeToken } from "../../src/types";

const expectStatesEqual = (state1: AccountState, state2: AccountState) => {
  expect(scalarsEqual(state1.id, state2.id)).toBe(true);
  expect(state1.nonce).toBe(state2.nonce);
  expect(state1.balance).toBe(state2.balance);
  if (state1.currentNoteIndex !== undefined) {
    expect(state1.currentNoteIndex).toBe(state2.currentNoteIndex!);
  } else {
    expect(state1.currentNoteIndex).toBe(undefined);
    expect(state2.currentNoteIndex).toBe(undefined);
  }
  expect(scalarsEqual(state1.currentNote, state2.currentNote)).toBe(true);
  expect(state1.storageSchemaVersion).toBe(state2.storageSchemaVersion);
};

describe("StateManager", () => {
  let stateManager: StateManager;
  let storage: StorageInterface;
  let cryptoClient: MockedCryptoClient;
  const testPrivateKey =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  let testId: Scalar;

  beforeEach(async () => {
    // Create mock storage
    const storageData: { [key: string]: any } = {};
    storage = {
      getItem: async (key: string) => storageData[key] || null,
      setItem: async (key: string, value: any) => {
        storageData[key] = value;
      }
    };
    cryptoClient = new MockedCryptoClient();
    stateManager = new StateManager(testPrivateKey, storage, cryptoClient);
    testId = await cryptoClient.secretManager.getIdPerToken(testPrivateKey, nativeTokenAddress);
  });

  describe("accountState", () => {
    it("returns empty state when no state exists", async () => {
      const state = await stateManager.accountState(nativeToken());
      const expectedId =
        await cryptoClient.secretManager.getIdPerToken(testPrivateKey, nativeTokenAddress);

      expect(state).toEqual({
        id: expectedId,
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n),
        storageSchemaVersion,
        token: nativeToken()
      });
    });

    it("returns existing state when id hash matches", async () => {
      const idHash = await cryptoClient.hasher.poseidonHash([testId]);

      await storage.setItem(nativeTokenAddress, {
        idHash: scalarToBigint(idHash),
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        currentNoteIndex: 0n,
        storageSchemaVersion
      });

      const token = nativeToken();

      const state = await stateManager.accountState(token);
      expectStatesEqual(state, {
        id: testId,
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(123n),
        currentNoteIndex: 0n,
        storageSchemaVersion,
        token: nativeToken()
      });
    });

    it("throws error when id hash doesn't match", async () => {
      await storage.setItem(nativeTokenAddress, {
        idHash: 999n, // Wrong hash
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        currentNoteIndex: 0n,
        storageSchemaVersion
      });

      await expect(stateManager.accountState(nativeToken())).rejects.toThrow(
        "Id hash in storage does not matched the configured."
      );
    });

    it("throws error when currentNoteIndex is undefined", async () => {
      await storage.setItem(nativeTokenAddress, {
        idHash: scalarToBigint(
          await cryptoClient.hasher.poseidonHash([testId])
        ),
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        storageSchemaVersion
      });

      await expect(stateManager.accountState(nativeToken())).rejects.toThrow(
        "currentNoteIndex must be set."
      );
    });
  });

  describe("updateAccountState", () => {
    it("updates state when all conditions are met", async () => {
      const newState: AccountState = {
        id: testId,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 1n,
        storageSchemaVersion,
        token: nativeToken()
      };

      await stateManager.updateAccountState(nativeToken(), newState);

      const storedState = await stateManager.accountState(nativeToken());
      expectStatesEqual(storedState, newState);
    });

    it("throws error when currentNoteIndex is undefined", async () => {
      const newState: AccountState = {
        id: testId,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        storageSchemaVersion,
        token: nativeToken()
      };

      await expect(
        stateManager.updateAccountState(nativeToken(), newState)
      ).rejects.toThrow("currentNoteIndex must be set.");
    });

    it("throws error when account id doesn't match", async () => {
      const wrongId = Scalar.fromBigint(999n);
      const newState: AccountState = {
        id: wrongId,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 1n,
        storageSchemaVersion,
        token: nativeToken()
      };

      await expect(
        stateManager.updateAccountState(nativeToken(), newState)
      ).rejects.toThrow("New account id does not match the configured.");
    });

    it("throws error when schema version doesn't match", async () => {
      const newState: AccountState = {
        id: testId,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 1n,
        storageSchemaVersion: 999, // Wrong version
        token: nativeToken()
      };

      await expect(
        stateManager.updateAccountState(nativeToken(), newState)
      ).rejects.toThrow("Storage schema version mismatch: 999 != 2");
    });
  });

  describe("emptyAccountState", () => {
    it("returns correct empty state", async () => {
      const emptyState = await stateManager.emptyAccountState(nativeToken());

      expect(emptyState).toEqual({
        id: testId,
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n),
        storageSchemaVersion,
        token: nativeToken()
      });
    });
  });
});
