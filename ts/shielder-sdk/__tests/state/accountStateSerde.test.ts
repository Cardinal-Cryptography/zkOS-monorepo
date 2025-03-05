import { it, expect, describe, beforeEach, vi } from "vitest";
import { AccountStateSerde } from "../../src/state/accountStateSerde";
import { IdManager } from "../../src/state/idManager";
import { MockedCryptoClient } from "../helpers";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountObject } from "../../src/storage/storageSchema";
import { nativeToken, erc20Token } from "../../src/utils";
import { AccountStateMerkleIndexed } from "../../src/state/types";

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";

describe("AccountStateSerde", () => {
  let accountStateSerde: AccountStateSerde;
  let idManager: IdManager;
  let cryptoClient: MockedCryptoClient;
  const testPrivateKey =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const testChainId = 1n;
  const testAccountIndex = 0;
  const testErc20Address = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    idManager = new IdManager(testPrivateKey, testChainId, cryptoClient);
    accountStateSerde = new AccountStateSerde(idManager);
  });

  describe("toAccountState", () => {
    it("should convert AccountObject to AccountState for native token", async () => {
      // Get the ID and ID hash for the test account index
      const id = await idManager.getId(testAccountIndex);
      const idHash = await idManager.getIdHash(testAccountIndex);

      // Create a mock AccountObject
      const accountObject: AccountObject = {
        idHash: scalarToBigint(idHash),
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Convert to AccountState
      const accountState = await accountStateSerde.toAccountState(
        accountObject,
        testAccountIndex,
        nativeToken()
      );

      // Verify the conversion
      expect(scalarsEqual(accountState.id, id)).toBe(true);
      expect(accountState.token).toEqual(nativeToken());
      expect(accountState.nonce).toBe(1n);
      expect(accountState.balance).toBe(100n);
      expect(accountState.currentNoteIndex).toBe(2n);
      expect(
        scalarsEqual(accountState.currentNote, Scalar.fromBigint(123n))
      ).toBe(true);
    });

    it("should convert AccountObject to AccountState for ERC20 token", async () => {
      // Get the ID and ID hash for the test account index
      const id = await idManager.getId(testAccountIndex);
      const idHash = await idManager.getIdHash(testAccountIndex);

      // Create a mock AccountObject
      const accountObject: AccountObject = {
        idHash: scalarToBigint(idHash),
        nonce: 2n,
        balance: 200n,
        currentNote: 456n,
        currentNoteIndex: 3n,
        tokenAddress: testErc20Address
      };

      // Convert to AccountState
      const token = erc20Token(testErc20Address);
      const accountState = await accountStateSerde.toAccountState(
        accountObject,
        testAccountIndex,
        token
      );

      // Verify the conversion
      expect(scalarsEqual(accountState.id, id)).toBe(true);
      expect(accountState.token).toEqual(token);
      expect(accountState.nonce).toBe(2n);
      expect(accountState.balance).toBe(200n);
      expect(accountState.currentNoteIndex).toBe(3n);
      expect(
        scalarsEqual(accountState.currentNote, Scalar.fromBigint(456n))
      ).toBe(true);
    });

    it("should throw when ID hash does not match", async () => {
      // Create a mock AccountObject with an invalid ID hash
      const accountObject: AccountObject = {
        idHash: 999999n, // Invalid ID hash
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Attempt to convert to AccountState should throw
      await expect(
        accountStateSerde.toAccountState(
          accountObject,
          testAccountIndex,
          nativeToken()
        )
      ).rejects.toThrow("ID hash does not match the expected value");
    });

    it("should validate ID hash during deserialization", async () => {
      // Spy on the validateIdHash method
      const validateSpy = vi.spyOn(idManager, "validateIdHash");

      // Get the ID hash for the test account index
      const idHash = await idManager.getIdHash(testAccountIndex);

      // Create a mock AccountObject
      const accountObject: AccountObject = {
        idHash: scalarToBigint(idHash),
        nonce: 1n,
        balance: 100n,
        currentNote: 123n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Convert to AccountState
      await accountStateSerde.toAccountState(
        accountObject,
        testAccountIndex,
        nativeToken()
      );

      // Verify that validateIdHash was called with the correct parameters
      expect(validateSpy).toHaveBeenCalledWith(
        testAccountIndex,
        scalarToBigint(idHash)
      );
    });
  });

  describe("toAccountObject", () => {
    it("should convert AccountState to AccountObject for native token", async () => {
      // Get the ID for the test account index
      const id = await idManager.getId(testAccountIndex);
      const idHash = await idManager.getIdHash(testAccountIndex);

      // Create a mock AccountState
      const accountState: AccountStateMerkleIndexed = {
        id,
        token: nativeToken(),
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(123n),
        currentNoteIndex: 2n
      };

      // Convert to AccountObject
      const accountObject = await accountStateSerde.toAccountObject(
        accountState,
        testAccountIndex
      );

      // Verify the conversion
      expect(accountObject.idHash).toBe(scalarToBigint(idHash));
      expect(accountObject.nonce).toBe(1n);
      expect(accountObject.balance).toBe(100n);
      expect(accountObject.currentNote).toBe(123n);
      expect(accountObject.currentNoteIndex).toBe(2n);
      expect(accountObject.tokenAddress).toBe(nativeTokenAddress);
    });

    it("should convert AccountState to AccountObject for ERC20 token", async () => {
      // Get the ID for the test account index
      const id = await idManager.getId(testAccountIndex);
      const idHash = await idManager.getIdHash(testAccountIndex);

      // Create a mock AccountState
      const token = erc20Token(testErc20Address);
      const accountState: AccountStateMerkleIndexed = {
        id,
        token,
        nonce: 2n,
        balance: 200n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 3n
      };

      // Convert to AccountObject
      const accountObject = await accountStateSerde.toAccountObject(
        accountState,
        testAccountIndex
      );

      // Verify the conversion
      expect(accountObject.idHash).toBe(scalarToBigint(idHash));
      expect(accountObject.nonce).toBe(2n);
      expect(accountObject.balance).toBe(200n);
      expect(accountObject.currentNote).toBe(456n);
      expect(accountObject.currentNoteIndex).toBe(3n);
      expect(accountObject.tokenAddress).toBe(testErc20Address);
    });

    it("should use getIdHash to get the ID hash", async () => {
      // Spy on the getIdHash method
      const getIdHashSpy = vi.spyOn(idManager, "getIdHash");

      // Get the ID for the test account index
      const id = await idManager.getId(testAccountIndex);

      // Create a mock AccountState
      const accountState: AccountStateMerkleIndexed = {
        id,
        token: nativeToken(),
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(123n),
        currentNoteIndex: 2n
      };

      // Convert to AccountObject
      await accountStateSerde.toAccountObject(accountState, testAccountIndex);

      // Verify that getIdHash was called with the correct parameters
      expect(getIdHashSpy).toHaveBeenCalledWith(testAccountIndex);
    });
  });
});
