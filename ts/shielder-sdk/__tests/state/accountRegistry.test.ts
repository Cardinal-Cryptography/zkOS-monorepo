import { it, expect, describe, beforeEach, vi } from "vitest";
import { AccountRegistry } from "../../src/state/accountRegistry";
import { AccountFactory } from "../../src/state/accountFactory";
import { AccountStateSerde } from "../../src/state/accountStateSerde";
import { StorageManager } from "../../src/storage/storageManager";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeToken, erc20Token } from "../../src/utils";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { Token } from "../../src/types";
import { AccountObject, createStorage } from "../../src/storage/storageSchema";

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";
const testErc20Address = "0x1111111111111111111111111111111111111111";

describe("AccountRegistry", () => {
  let accountRegistry: AccountRegistry;
  let storageManager: StorageManager;
  let accountFactory: AccountFactory;
  let accountStateSerde: AccountStateSerde;

  const createMockAccountState = (
    token: Token = nativeToken(),
    nonce = 1n,
    balance = 100n
  ): AccountStateMerkleIndexed => ({
    id: Scalar.fromBigint(789n),
    token,
    nonce,
    balance,
    currentNote: Scalar.fromBigint(456n),
    currentNoteIndex: 2n
  });

  const createMockAccountObject = (
    tokenAddress = nativeTokenAddress,
    nonce = 1n,
    balance = 100n
  ): AccountObject => ({
    idHash: 123n,
    nonce,
    balance,
    currentNote: 456n,
    currentNoteIndex: 2n,
    tokenAddress
  });

  beforeEach(() => {
    storageManager = {
      findAccountByTokenAddress: vi.fn(),
      getNextAccountIndex: vi.fn(),
      saveRawAccount: vi.fn(),
      saveRawAccountAndIncrementNextAccountIndex: vi.fn(),
      getRawAccount: vi.fn()
    } as unknown as StorageManager;

    accountFactory = {
      createEmptyAccountState: vi.fn()
    } as unknown as AccountFactory;

    accountStateSerde = {
      toAccountState: vi.fn(),
      toAccountObject: vi.fn()
    } as unknown as AccountStateSerde;

    accountRegistry = new AccountRegistry(
      storageManager,
      accountFactory,
      accountStateSerde
    );
  });

  describe("createEmptyAccountState", () => {
    it("should create empty account state with next index", async () => {
      const token = nativeToken();
      const nextAccountIndex = 5;
      const expectedEmptyState = createMockAccountState(token, 0n, 0n);

      vi.mocked(storageManager.getNextAccountIndex).mockResolvedValue(
        nextAccountIndex
      );
      vi.mocked(accountFactory.createEmptyAccountState).mockResolvedValue(
        expectedEmptyState
      );

      const result = await accountRegistry.createEmptyAccountState(token);

      expect(result).toBe(expectedEmptyState);
      expect(storageManager.getNextAccountIndex).toHaveBeenCalled();
      expect(accountFactory.createEmptyAccountState).toHaveBeenCalledWith(
        token,
        nextAccountIndex
      );
    });
  });

  describe("getAccountState", () => {
    it("should return existing account state when found", async () => {
      const token = nativeToken();
      const accountIndex = 0;
      const mockAccountObject = createMockAccountObject();
      const expectedAccountState = createMockAccountState();

      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue({
        accountIndex,
        accountObject: mockAccountObject
      });
      vi.mocked(accountStateSerde.toAccountState).mockResolvedValue(
        expectedAccountState
      );

      const result = await accountRegistry.getAccountState(token);

      expect(result).toBe(expectedAccountState);
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        nativeTokenAddress
      );
      expect(accountStateSerde.toAccountState).toHaveBeenCalledWith(
        mockAccountObject,
        accountIndex,
        token
      );
    });

    it("should return null when account not found", async () => {
      const token = erc20Token(testErc20Address);

      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue(
        null
      );

      const result = await accountRegistry.getAccountState(token);

      expect(result).toBe(null);
      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        testErc20Address
      );
    });
  });

  describe("updateAccountState", () => {
    it("should update existing account state", async () => {
      const token = nativeToken();
      const accountIndex = 0;
      const accountState = createMockAccountState();
      const mockAccountObject = createMockAccountObject();

      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue({
        accountIndex,
        accountObject: {} as AccountObject
      });
      vi.mocked(accountStateSerde.toAccountObject).mockResolvedValue(
        mockAccountObject
      );

      await accountRegistry.updateAccountState(token, accountState);

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
    });

    it("should create new account state when not found", async () => {
      const token = erc20Token(testErc20Address);
      const nextAccountIndex = 1;
      const accountState = createMockAccountState(token, 0n, 0n);
      const mockAccountObject = createMockAccountObject(
        testErc20Address,
        0n,
        0n
      );

      vi.mocked(storageManager.findAccountByTokenAddress).mockResolvedValue(
        null
      );
      vi.mocked(storageManager.getNextAccountIndex).mockResolvedValue(
        nextAccountIndex
      );
      vi.mocked(accountStateSerde.toAccountObject).mockResolvedValue(
        mockAccountObject
      );

      await accountRegistry.updateAccountState(token, accountState);

      expect(storageManager.findAccountByTokenAddress).toHaveBeenCalledWith(
        testErc20Address
      );
      expect(storageManager.getNextAccountIndex).toHaveBeenCalled();
      expect(accountStateSerde.toAccountObject).toHaveBeenCalledWith(
        accountState,
        nextAccountIndex
      );
      expect(storageManager.saveRawAccount).toHaveBeenCalledWith(
        nextAccountIndex,
        mockAccountObject
      );
    });
  });

  describe("getTokenByAccountIndex", () => {
    [
      {
        index: 0,
        accountObject: createMockAccountObject(nativeTokenAddress),
        expected: nativeToken()
      },
      {
        index: 1,
        accountObject: createMockAccountObject(testErc20Address),
        expected: erc20Token(testErc20Address)
      },
      {
        index: 999,
        accountObject: null,
        expected: null
      }
    ].forEach(({ index, accountObject, expected }) => {
      it(`should return correct token based on account index: ${index}`, async () => {
        vi.mocked(storageManager.getRawAccount).mockResolvedValue(
          accountObject
        );

        const result = await accountRegistry.getTokenByAccountIndex(index);

        expect(result).toEqual(expected);
        expect(storageManager.getRawAccount).toHaveBeenCalledWith(index);
        vi.clearAllMocks();
      });
    });
  });

  describe("getAccountStatesList", () => {
    beforeEach(() => {
      const map = new Map<string, string>();
      storageManager = new StorageManager(
        createStorage({
          getItem: async (key: string) => {
            return map.get(key) ?? null;
          },
          setItem: async (key: string, value: string) => {
            map.set(key, value);
          }
        })
      );
      accountRegistry = new AccountRegistry(
        storageManager,
        accountFactory,
        accountStateSerde
      );
    });
    it("should return list of account states", async () => {
      const accountObject = createMockAccountObject();
      const token = nativeToken();
      const accountState = createMockAccountState(token);
      const accountObject2 = createMockAccountObject(testErc20Address);
      const token2 = erc20Token(testErc20Address);
      const accountState2 = createMockAccountState(token2);

      await storageManager.saveRawAccount(0, accountObject);
      await storageManager.saveRawAccount(1, accountObject2);

      vi.mocked(accountStateSerde.toAccountState)
        .mockResolvedValueOnce(accountState)
        .mockResolvedValueOnce(accountState2);

      const result = await accountRegistry.getAccountStatesList();

      expect(result).toEqual([accountState, accountState2]);
      expect(accountStateSerde.toAccountState).toHaveBeenCalledWith(
        accountObject,
        0,
        token
      );
      expect(accountStateSerde.toAccountState).toHaveBeenCalledWith(
        accountObject2,
        1,
        token2
      );
    });
  });
});
