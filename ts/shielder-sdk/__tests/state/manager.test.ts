import { it, expect, describe, beforeEach } from "vitest";
import { StateManager } from "../../src/state/manager";
import { MockedCryptoClient } from "../helpers";
import { StorageInterface } from "../../src/storage/storageSchema";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { storageSchemaVersion } from "../../src/constants";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeToken } from "../../src/types";

const expectStatesEqual = (
  state1: AccountStateMerkleIndexed,
  state2: AccountStateMerkleIndexed
) => {
  expect(scalarsEqual(state1.id, state2.id)).toBe(true);
  expect(state1.nonce).toBe(state2.nonce);
  expect(state1.balance).toBe(state2.balance);
  expect(state1.currentNoteIndex).toBe(state2.currentNoteIndex!);
  expect(scalarsEqual(state1.currentNote, state2.currentNote)).toBe(true);
};

describe("StateManager", () => {
  let stateManager: StateManager;
  let storage: StorageInterface;
  let cryptoClient: MockedCryptoClient;
  const nativeTokenAddress = "0x0000000000000000000000000000000000000000";
  const testPrivateKey =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  let testId: Scalar;
  const mockChainId = 2n;

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
    stateManager = new StateManager(
      testPrivateKey,
      mockChainId,
      storage,
      cryptoClient
    );
    testId = await cryptoClient.secretManager.deriveId(
      testPrivateKey,
      mockChainId,
      nativeTokenAddress
    );
  });

  describe("accountState", () => {
    it("returns empty state when no state exists", async () => {
      const state = await stateManager.accountState(nativeToken());
      const expectedId = await cryptoClient.secretManager.deriveId(
        testPrivateKey,
        mockChainId,
        nativeTokenAddress
      );

      expect(state).toEqual({
        id: expectedId,
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n),
        currentNoteIndex: 0n,
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
  });

  describe("updateAccountState", () => {
    it("updates state when all conditions are met", async () => {
      const newState: AccountStateMerkleIndexed = {
        id: testId,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 1n,
        token: nativeToken()
      };

      await stateManager.updateAccountState(nativeToken(), newState);

      const storedState = await stateManager.accountState(nativeToken());
      expectStatesEqual(storedState, newState);
    });

    it("throws error when account id doesn't match", async () => {
      const wrongId = Scalar.fromBigint(999n);
      const newState: AccountStateMerkleIndexed = {
        id: wrongId,
        nonce: 1n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 1n,
        token: nativeToken()
      };

      await expect(
        stateManager.updateAccountState(nativeToken(), newState)
      ).rejects.toThrow("New account id does not match the configured.");
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
        currentNoteIndex: 0n,
        token: nativeToken()
      });
    });
  });
});
