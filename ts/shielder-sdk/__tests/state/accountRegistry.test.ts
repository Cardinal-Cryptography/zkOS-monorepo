import { it, expect, describe, beforeEach, vi } from "vitest";
import { AccountRegistry } from "../../src/state/accountRegistry";
import { AccountFactory } from "../../src/state/accountFactory";
import { AccountStateSerde } from "../../src/state/accountStateSerde";
import { StorageManager } from "../../src/storage/storageManager";
import { MockedCryptoClient } from "../helpers";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeToken, erc20Token } from "../../src/utils";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { AccountObject } from "../../src/storage/storageSchema";

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";

describe("AccountRegistry", () => {
  let accountRegistry: AccountRegistry;
  let storageManager: StorageManager;
  let accountFactory: AccountFactory;
  let accountStateSerde: AccountStateSerde;
  let cryptoClient: MockedCryptoClient;
  const testErc20Address = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    // Mock the StorageManager
    storageManager = {
      findAccountByTokenAddress: vi.fn(),
      getNextAccountIndex: vi.fn(),
      saveRawAccount: vi.fn(),
      saveRawAccountAndIncrementNextAccountIndex: vi.fn(),
      getRawAccount: vi.fn()
    } as unknown as StorageManager;

    // Mock the AccountFactory
    accountFactory = {
      createEmptyAccountState: vi.fn()
    } as unknown as AccountFactory;

    // Mock the AccountStateSerde
    accountStateSerde = {
      toAccountState: vi.fn(),
      toAccountObject: vi.fn()
    } as unknown as AccountStateSerde;

    // Create the AccountRegistry with mocked dependencies
    accountRegistry = new AccountRegistry(
      storageManager,
      accountFactory,
      accountStateSerde
    );
  });

  describe("createEmptyAccountState", () => {
    it("should create empty account state with next index", async () => {
      // Mock the token and account index
      const token = nativeToken();
      const nextAccountIndex = 5;

      // Mock the expected empty account state
      const expectedEmptyState: AccountStateMerkleIndexed = {
        id: Scalar.fromBigint(789n),
        token,
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n),
        currentNoteIndex: 0n
      };

      // Setup the mocks
      vi.mocked(storageManager.getNextAccountIndex).mockResolvedValue(
        nextAccountIndex
      );
      vi.mocked(accountFactory.createEmptyAccountState).mockResolvedValue(
        expectedEmptyState
      );

      // Call the method
      const result = await accountRegistry.createEmptyAccountState(token);

      // Verify the result
      expect(result).toBe(expectedEmptyState);

      // Verify the mocks were called correctly
      expect(storageManager.getNextAccountIndex).toHaveBeenCalled();
      expect(accountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        token,
        nextAccountIndex
      );
    });

    it("should handle errors when getNextAccountIndex fails", async () => {
      // Mock the token
      const token = nativeToken();

      // Setup the mocks to throw an error
      const mockError = new Error("Failed to get next account index");
      vi.mocked(storageManager.getNextAccountIndex).mockRejectedValue(
        mockError
      );

      // Call the method and expect it to throw
      await expect(
        accountRegistry.createEmptyAccountState(token)
      ).rejects.toThrow(mockError);

      // Verify the mocks were called correctly
      expect(storageManager.getNextAccountIndex).toHaveBeenCalled();
      expect(accountFactory.createEmptyAccountState).not.toHaveBeenCalled();
    });
  });

  describe("getAccountState", () => {
    it("should return existing account state when found", async () => {
      // Mock the token and account index
      const token = nativeToken();
      const accountIndex = 0;

      // Mock the account object that would be returned from storage
      const mockAccountObject: AccountObject = {
        idHash: 123n,
        nonce: 1n,
        balance: 100n,
        currentNote: 456n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Mock the expected account state
      const expectedAccountState: AccountStateMerkleIndexed = {
        id: Scalar.fromBigint(789n),
        token,
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 2n
      };

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue({
        accountIndex,
        accountObject: mockAccountObject
      });

      vi.mocked(accountStateSerde.toAccountState).mockResolvedValue(
        expectedAccountState
      );

      // Call the method
      const result = await accountRegistry.getAccountState(token);

      // Verify the result
      expect(result).toBe(expectedAccountState);

      // Verify the mocks were called correctly
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        nativeTokenAddress
      );
      expect(accountStateSerde.toAccountState).toHaveBeenCalledWith(
        mockAccountObject,
        accountIndex,
        token
      );
      expect(accountFactory.createEmptyAccountState).not.toHaveBeenCalled();
    });

    it("should return null when not found", async () => {
      // Mock the token and account index
      const token = erc20Token(testErc20Address);

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue(
        null
      );
      // Call the method
      const result = await accountRegistry.getAccountState(token);

      // Verify the result
      expect(result).toBe(null);
    });

    it("should handle errors when account is found but toAccountState fails", async () => {
      // Mock the token and account index
      const token = nativeToken();
      const accountIndex = 0;

      // Mock the account object that would be returned from storage
      const mockAccountObject: AccountObject = {
        idHash: 123n,
        nonce: 1n,
        balance: 100n,
        currentNote: 456n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue({
        accountIndex,
        accountObject: mockAccountObject
      });

      const mockError = new Error("Failed to convert to account state");
      vi.mocked(accountStateSerde.toAccountState).mockRejectedValue(mockError);

      // Call the method and expect it to throw
      await expect(accountRegistry.getAccountState(token)).rejects.toThrow(
        mockError
      );

      // Verify the mocks were called correctly
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        nativeTokenAddress
      );
      expect(accountStateSerde.toAccountState).toHaveBeenCalledWith(
        mockAccountObject,
        accountIndex,
        token
      );
    });
  });

  describe("updateAccountState", () => {
    it("should update existing account state", async () => {
      // Mock the token and account index
      const token = nativeToken();
      const accountIndex = 0;

      // Mock the account state to update
      const accountState: AccountStateMerkleIndexed = {
        id: Scalar.fromBigint(789n),
        token,
        nonce: 1n,
        balance: 100n,
        currentNote: Scalar.fromBigint(456n),
        currentNoteIndex: 2n
      };

      // Mock the account object that would be created
      const mockAccountObject: AccountObject = {
        idHash: 123n,
        nonce: 1n,
        balance: 100n,
        currentNote: 456n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue({
        accountIndex,
        accountObject: {} as AccountObject // Not used in this test
      });

      vi.mocked(accountStateSerde.toAccountObject).mockResolvedValue(
        mockAccountObject
      );

      // Call the method
      await accountRegistry.updateAccountState(token, accountState);

      // Verify the mocks were called correctly
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        nativeTokenAddress
      );
      expect(accountStateSerde.toAccountObject).toHaveBeenCalledWith(
        accountState,
        accountIndex
      );
      expect(storageManager.saveRawAccount).toHaveBeenCalledWith(
        accountIndex,
        mockAccountObject
      );
      expect(
        storageManager.saveRawAccountAndIncrementNextAccountIndex
      ).not.toHaveBeenCalled();
    });

    it("should create new account state when not found", async () => {
      // Mock the token and account index
      const token = erc20Token(testErc20Address);
      const nextAccountIndex = 1;

      // Mock the account state to create
      const accountState: AccountStateMerkleIndexed = {
        id: Scalar.fromBigint(789n),
        token,
        nonce: 0n,
        balance: 0n,
        currentNote: Scalar.fromBigint(0n),
        currentNoteIndex: 0n
      };

      // Mock the account object that would be created
      const mockAccountObject: AccountObject = {
        idHash: 123n,
        nonce: 0n,
        balance: 0n,
        currentNote: 0n,
        currentNoteIndex: 0n,
        tokenAddress: testErc20Address
      };

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue(
        null
      );
      vi.mocked(storageManager.getNextAccountIndex).mockResolvedValue(
        nextAccountIndex
      );
      vi.mocked(accountStateSerde.toAccountObject).mockResolvedValue(
        mockAccountObject
      );

      // Call the method
      await accountRegistry.updateAccountState(token, accountState);

      // Verify the mocks were called correctly
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        testErc20Address
      );
      expect(storageManager.getNextAccountIndex).toHaveBeenCalled();
      expect(accountStateSerde.toAccountObject).toHaveBeenCalledWith(
        accountState,
        nextAccountIndex
      );
      expect(storageManager.saveRawAccount).not.toHaveBeenCalled();
      expect(
        storageManager.saveRawAccountAndIncrementNextAccountIndex
      ).toHaveBeenCalledWith(nextAccountIndex, mockAccountObject);
    });
  });

  describe("getAccountIndex", () => {
    it("should return account index when found", async () => {
      // Mock the token and account index
      const token = nativeToken();
      const accountIndex = 0;

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue({
        accountIndex,
        accountObject: {} as AccountObject // Not used in this test
      });

      // Call the method
      const result = await accountRegistry.getAccountIndex(token);

      // Verify the result
      expect(result).toBe(accountIndex);

      // Verify the mocks were called correctly
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        nativeTokenAddress
      );
    });

    it("should return null when not found", async () => {
      // Mock the token
      const token = erc20Token(testErc20Address);

      // Setup the mocks
      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue(
        null
      );

      // Call the method
      const result = await accountRegistry.getAccountIndex(token);

      // Verify the result
      expect(result).toBeNull();

      // Verify the mocks were called correctly
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        testErc20Address
      );
    });
  });

  describe("getTokenByAccountIndex", () => {
    it("should return token when account found", async () => {
      // Mock the account index
      const accountIndex = 0;

      // Mock the account object that would be returned from storage
      const mockAccountObject: AccountObject = {
        idHash: 123n,
        nonce: 1n,
        balance: 100n,
        currentNote: 456n,
        currentNoteIndex: 2n,
        tokenAddress: nativeTokenAddress
      };

      // Setup the mocks
      vi.mocked(storageManager.getRawAccount).mockResolvedValue(
        mockAccountObject
      );

      // Call the method
      const result = await accountRegistry.getTokenByAccountIndex(accountIndex);

      // Verify the result
      expect(result).toEqual(nativeToken());

      // Verify the mocks were called correctly
      expect(storageManager.getRawAccount).toHaveBeenCalledWith(accountIndex);
    });

    it("should return null when account not found", async () => {
      // Mock the account index
      const accountIndex = 999;

      // Setup the mocks
      vi.mocked(storageManager.getRawAccount).mockResolvedValue(null);

      // Call the method
      const result = await accountRegistry.getTokenByAccountIndex(accountIndex);

      // Verify the result
      expect(result).toBeNull();

      // Verify the mocks were called correctly
      expect(storageManager.getRawAccount).toHaveBeenCalledWith(accountIndex);
    });

    it("should return ERC20 token when account has ERC20 token address", async () => {
      // Mock the account index
      const accountIndex = 1;

      // Mock the account object that would be returned from storage
      const mockAccountObject: AccountObject = {
        idHash: 123n,
        nonce: 1n,
        balance: 100n,
        currentNote: 456n,
        currentNoteIndex: 2n,
        tokenAddress: testErc20Address
      };

      // Setup the mocks
      vi.mocked(storageManager.getRawAccount).mockResolvedValue(
        mockAccountObject
      );

      // Call the method
      const result = await accountRegistry.getTokenByAccountIndex(accountIndex);

      // Verify the result
      expect(result).toEqual(erc20Token(testErc20Address));

      // Verify the mocks were called correctly
      expect(storageManager.getRawAccount).toHaveBeenCalledWith(accountIndex);
    });
  });
});
