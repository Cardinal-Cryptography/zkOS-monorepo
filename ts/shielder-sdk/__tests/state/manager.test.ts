import { it, expect, describe, beforeEach } from "vitest";
import { StateManager } from "../../src/state/manager";
import { IdManager } from "../../src/state/idManager";
import { AccountFactory } from "../../src/state/accountFactory";
import { MockedCryptoClient } from "../helpers";
import { StorageInterface } from "../../src/storage/storageSchema";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { storageSchemaVersion } from "../../src/constants";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeTokenAddress } from "../../src/constants";
import { nativeToken } from "../../src/utils";

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
  let idManager: IdManager;
  let accountFactory: AccountFactory;
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

    // Create IdManager and AccountFactory
    idManager = new IdManager(testPrivateKey, mockChainId, cryptoClient);
    accountFactory = new AccountFactory(idManager);

    // Create StateManager with the dependencies
    stateManager = new StateManager(storage, idManager, accountFactory);

    testId = await cryptoClient.secretManager.deriveId(
      testPrivateKey,
      mockChainId,
      nativeTokenAddress
    );
  });

  describe("accountState", () => {
    it("returns empty state when no state exists", async () => {
      const state = await stateManager.accountState(nativeToken());

      expect(state).toEqual(null);
    });

    it("creates correct empty state", async () => {
      const state = await stateManager.createEmptyAccountState(nativeToken());
      const expectedState =
        await accountFactory.createEmptyAccountState(nativeToken());

      expect(state).toEqual(expectedState);
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
      expect(state).not.toBeNull();
      expectStatesEqual(state!, {
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
        "ID hash does not match the expected value"
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
      expect(storedState).not.toBeNull();
      expectStatesEqual(storedState!, newState);
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
});
