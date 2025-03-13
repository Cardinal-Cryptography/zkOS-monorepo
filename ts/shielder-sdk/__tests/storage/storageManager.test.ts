import { it, expect, vitest, describe, beforeEach } from "vitest";
import { StorageManager } from "../../src/storage/storageManager";
import {
  AccountObject,
  StorageInterface
} from "../../src/storage/storageSchema";

const mockedTokenAddress = "0x7e50210642A8C6ecf8fd13Ce2E20A4F52C6C4d9a";

describe("StorageManager", () => {
  let mockStorage: {
    getStorage: ReturnType<typeof vitest.fn>;
    setStorage: ReturnType<typeof vitest.fn>;
  };
  let storageManager: StorageManager;
  let mockStorageData: {
    accounts: Map<string, AccountObject>;
    nextAccountIndex: number;
    storageSchemaVersion: number;
  };
  let sampleAccount: AccountObject;

  beforeEach(() => {
    // Create a sample account for testing
    sampleAccount = {
      nonce: 1n,
      balance: 1000n,
      idHash: 12345n,
      currentNote: 67890n,
      currentNoteIndex: 2n,
      tokenAddress: mockedTokenAddress
    };

    // Initialize mock storage data
    mockStorageData = {
      accounts: new Map<string, AccountObject>(),
      nextAccountIndex: 1,
      storageSchemaVersion: 2
    };

    // Set up mock storage interface
    mockStorage = {
      getStorage: vitest.fn().mockResolvedValue(mockStorageData),
      setStorage: vitest.fn().mockResolvedValue(undefined)
    };

    // Create storage manager with mock storage
    storageManager = new StorageManager(mockStorage as StorageInterface);
  });

  describe("getRawAccount", () => {
    it("should return null for non-existent account", async () => {
      const result = await storageManager.getRawAccount(0);
      expect(result).toBeNull();
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });

    it("should return account object for existing account", async () => {
      // Add an account to the mock storage
      mockStorageData.accounts.set("0", sampleAccount);

      const result = await storageManager.getRawAccount(0);
      expect(result).toEqual(sampleAccount);
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });

    it("should handle storage errors", async () => {
      mockStorage.getStorage.mockRejectedValueOnce(new Error("Storage error"));

      await expect(storageManager.getRawAccount(0)).rejects.toThrow(
        "Storage error"
      );
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });
  });

  describe("saveRawAccount", () => {
    it("should save a new account", async () => {
      await storageManager.saveRawAccount(0, sampleAccount);

      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
      expect(mockStorage.setStorage).toHaveBeenCalledTimes(1);
      expect(mockStorage.setStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          accounts: expect.any(Map)
        })
      );

      // Check that the account was added to the map
      const setStorageCall = mockStorage.setStorage.mock.calls[0][0];
      expect(setStorageCall.accounts.get("0")).toEqual(sampleAccount);
      expect(setStorageCall.nextAccountIndex).toBe(1);
    });

    it("should update an existing account", async () => {
      // Add an initial account
      mockStorageData.accounts.set("0", { ...sampleAccount, balance: 500n });
      mockStorageData.nextAccountIndex = 1;

      // Update the account
      await storageManager.saveRawAccount(0, sampleAccount);

      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
      expect(mockStorage.setStorage).toHaveBeenCalledTimes(1);

      // Check that the account was updated
      const setStorageCall = mockStorage.setStorage.mock.calls[0][0];
      expect(setStorageCall.accounts.get("0")).toEqual(sampleAccount);
      expect(setStorageCall.nextAccountIndex).toBe(1);
    });

    it("should throw an error if the account index is greater than the next account index", async () => {
      await expect(
        storageManager.saveRawAccount(2, sampleAccount)
      ).rejects.toThrow(
        "Cannot save account at index 2 when next account index is 1"
      );
    });
  });

  describe("getNextAccountIndex", () => {
    it("should return the next account index", async () => {
      mockStorageData.nextAccountIndex = 5;

      const result = await storageManager.getNextAccountIndex();
      expect(result).toBe(5);
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });

    it("should handle storage errors", async () => {
      mockStorage.getStorage.mockRejectedValueOnce(new Error("Storage error"));

      await expect(storageManager.getNextAccountIndex()).rejects.toThrow(
        "Storage error"
      );
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAccountByTokenAddress", () => {
    it("should return null when no account with the token address exists", async () => {
      const result = await storageManager.findAccountByTokenAddress("0x1234");
      expect(result).toBeNull();
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });

    it("should find an account by token address", async () => {
      // Add accounts with different token addresses
      const account1 = { ...sampleAccount, tokenAddress: "0x1234" };
      const account2 = { ...sampleAccount, tokenAddress: "0x5678" };

      mockStorageData.accounts.set("0", account1);
      mockStorageData.accounts.set("1", account2);

      const result = await storageManager.findAccountByTokenAddress("0x5678");

      expect(result).toEqual({
        accountIndex: 1,
        accountObject: account2
      });
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });

    it("should return the first account if multiple accounts have the same token address", async () => {
      // Add multiple accounts with the same token address
      const account1 = { ...sampleAccount, tokenAddress: "0x1234" };
      const account2 = { ...sampleAccount, tokenAddress: "0x1234" };

      mockStorageData.accounts.set("0", account1);
      mockStorageData.accounts.set("1", account2);

      const result = await storageManager.findAccountByTokenAddress("0x1234");

      expect(result).toEqual({
        accountIndex: 0,
        accountObject: account1
      });
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });

    it("should handle storage errors", async () => {
      mockStorage.getStorage.mockRejectedValueOnce(new Error("Storage error"));

      await expect(
        storageManager.findAccountByTokenAddress("0x1234")
      ).rejects.toThrow("Storage error");
      expect(mockStorage.getStorage).toHaveBeenCalledTimes(1);
    });
  });
});
