import { describe, it, expect, vitest, beforeEach, Mocked } from "vitest";

import { Address, Hash, PublicClient } from "viem";
import { MockedCryptoClient } from "../helpers";
import { ShielderClient } from "../../src/client/client";
import { createShielderClient } from "../../src/client/factories";
import { Contract } from "../../src/chain/contract";
import { quotedFeesFromTotalFee, Relayer } from "../../src/chain/relayer";
import { InjectedStorageInterface } from "../../src/storage/storageSchema";
import {
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../../src/state/types";
import { OutdatedSdkError } from "../../src/errors";
import { ShielderCallbacks } from "../../src/client/types";
import { nativeToken } from "../../src/utils";
import { ShielderActions } from "../../src/client/actions";
import { AccountRegistry } from "../../src/state/accountRegistry";
import { StateSynchronizer } from "../../src/state/sync/synchronizer";
import { HistoryFetcher } from "../../src/state/sync/historyFetcher";
import { ShielderComponents } from "../../src/client/factories";

vitest.mock("../../src/chain/contract");
vitest.mock("../../src/chain/relayer");
vitest.mock("../../src/client/actions");
vitest.mock("viem", async () => {
  const orig = await vitest.importActual("viem");
  return {
    ...orig,
    createPublicClient: vitest.fn().mockReturnValue({
      waitForTransactionReceipt: vitest.fn()
    })
  };
});

describe("ShielderClient", () => {
  let client: ShielderClient;
  let mockContract: Mocked<Contract>;
  let mockRelayer: Mocked<Relayer>;
  let mockPublicClient: Mocked<PublicClient>;
  let mockAccountRegistry: Mocked<AccountRegistry>;
  let mockStateSynchronizer: Mocked<StateSynchronizer>;
  let mockHistoryFetcher: Mocked<HistoryFetcher>;
  let mockShielderActions: Mocked<ShielderActions>;
  let callbacks: ShielderCallbacks;
  let mockState: AccountStateMerkleIndexed;
  const mockedRelayerAddress =
    "0x1234567890123456789012345678901234567890" as const;

  beforeEach(() => {
    // Reset mocks
    vitest.clearAllMocks();

    // Setup mocks
    mockContract = new Contract(
      null as any,
      "0x" as Address
    ) as Mocked<Contract>;
    mockRelayer = {
      address: vitest.fn().mockResolvedValue(mockedRelayerAddress)
    } as unknown as Mocked<Relayer>;
    mockPublicClient = {
      waitForTransactionReceipt: vitest
        .fn()
        .mockResolvedValue({ status: "success" })
    } as unknown as Mocked<PublicClient>;

    mockAccountRegistry = {
      getAccountState: vitest.fn(),
      getAccountStatesList: vitest.fn()
    } as unknown as Mocked<AccountRegistry>;

    mockStateSynchronizer = {
      syncAllAccounts: vitest.fn().mockResolvedValue([]),
      syncSingleAccount: vitest.fn().mockResolvedValue([])
    } as unknown as Mocked<StateSynchronizer>;

    mockHistoryFetcher = {
      getTransactionHistory: vitest.fn()
    } as unknown as Mocked<HistoryFetcher>;

    mockShielderActions = {
      getWithdrawFees: vitest.fn(),
      shield: vitest.fn(),
      withdraw: vitest.fn(),
      withdrawManual: vitest.fn()
    } as unknown as Mocked<ShielderActions>;

    callbacks = {
      onCalldataGenerated: vitest.fn(),
      onCalldataSent: vitest.fn(),
      onError: vitest.fn()
    };

    // Create client instance with mocked components
    const components: ShielderComponents = {
      accountRegistry: mockAccountRegistry,
      stateSynchronizer: mockStateSynchronizer,
      historyFetcher: mockHistoryFetcher,
      shielderActions: mockShielderActions
    };

    client = new ShielderClient(components, callbacks);

    mockState = {
      id: {} as any,
      nonce: 1n,
      balance: 1000n,
      currentNote: {} as any,
      token: nativeToken(),
      currentNoteIndex: 0n
    } as AccountStateMerkleIndexed;

    mockAccountRegistry.getAccountState.mockResolvedValue(mockState);
  });

  describe("createShielderClient", () => {
    const mockShielderSeedPrivateKey =
      "0x1234567890123456789012345678901234567890123456789012345678901234" as const;
    const mockChainId = 1n;
    const mockContractAddress =
      "0x1234567890123456789012345678901234567890" as Address;
    const mockRelayerUrl = "http://localhost:3000";
    const mockCryptoClient = new MockedCryptoClient();
    const mockStorageInterface: InjectedStorageInterface = {
      getItem: vitest
        .fn<(key: string) => Promise<string | null>>()
        .mockImplementation(async () => null),
      setItem: vitest
        .fn<(key: string, value: string) => Promise<void>>()
        .mockImplementation(async () => {})
    };
    let client: ShielderClient;

    beforeEach(() => {
      vitest.clearAllMocks();
      client = createShielderClient({
        shielderSeedPrivateKey: mockShielderSeedPrivateKey,
        chainId: mockChainId,
        publicClient: {} as PublicClient,
        contractAddress: mockContractAddress,
        relayerUrl: mockRelayerUrl,
        storage: mockStorageInterface,
        cryptoClient: mockCryptoClient
      });
    });

    it("should create ShielderClient with correct parameters", () => {
      expect(client).toBeInstanceOf(ShielderClient);
      expect(Contract).toHaveBeenCalledWith(
        expect.anything(),
        mockContractAddress
      );
      expect(Relayer).toHaveBeenCalledWith(mockRelayerUrl);
    });

    it("should create ShielderClient with default callbacks", () => {
      expect(client).toBeInstanceOf(ShielderClient);
      // Verify that the client was created with empty callbacks object
      expect(client["callbacks"]).toEqual({});
    });

    it("should create ShielderClient with provided callbacks", () => {
      const mockCallbacks = {
        onCalldataGenerated: vitest.fn(),
        onCalldataSent: vitest.fn(),
        onNewTransaction: vitest.fn(),
        onError: vitest.fn()
      };

      client = createShielderClient({
        shielderSeedPrivateKey: mockShielderSeedPrivateKey,
        chainId: mockChainId,
        publicClient: {} as PublicClient,
        contractAddress: mockContractAddress,
        relayerUrl: mockRelayerUrl,
        storage: mockStorageInterface,
        cryptoClient: mockCryptoClient,
        callbacks: mockCallbacks
      });

      expect(client).toBeInstanceOf(ShielderClient);
      // Verify that the client was created with the provided callbacks
      expect(client["callbacks"]).toEqual(mockCallbacks);
    });
  });

  describe("syncShielder", () => {
    it("should call stateSynchronizer", async () => {
      await client.syncShielder();

      expect(mockStateSynchronizer.syncAllAccounts).toHaveBeenCalledTimes(1);
    });

    it("should handle errors", async () => {
      const mockError = new Error("Sync error");
      mockStateSynchronizer.syncAllAccounts.mockRejectedValue(mockError);

      await expect(client.syncShielder()).rejects.toThrow(mockError);
      expect(callbacks.onError).toHaveBeenCalledWith(
        mockError,
        "syncing",
        "sync"
      );
    });

    it("should handle OutdatedSdkError", async () => {
      const mockError = new OutdatedSdkError("Outdated SDK version");
      mockStateSynchronizer.syncAllAccounts.mockRejectedValue(mockError);

      await expect(client.syncShielder()).rejects.toThrow(mockError);
      expect(callbacks.onError).toHaveBeenCalledWith(
        mockError,
        "syncing",
        "sync"
      );
    });
  });

  describe("accountStatesList", () => {
    it("should return account states list", async () => {
      const mockAccountStates = [mockState];
      mockAccountRegistry.getAccountStatesList.mockResolvedValue(
        mockAccountStates
      );

      const accountStates = await client.accountStatesList();

      expect(accountStates).toEqual(mockAccountStates);
      expect(mockAccountRegistry.getAccountStatesList).toHaveBeenCalledTimes(1);
    });
  });

  describe("accountState", () => {
    it("should return current account state", async () => {
      const state = await client.accountState(nativeToken());

      expect(state).toEqual(mockState);
      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        nativeToken()
      );
    });
  });

  describe("scanChainForTokenShielderTransactions", () => {
    it("should yield transactions successfully", async () => {
      const mockTransactions: ShielderTransaction[] = [
        {
          type: "NewAccount",
          amount: 1000n,
          txHash: "0x123" as Hash,
          block: 1n,
          token: nativeToken()
        },
        {
          type: "Deposit",
          amount: 2000n,
          txHash: "0x456" as Hash,
          block: 2n,
          token: nativeToken()
        }
      ];

      mockHistoryFetcher.getTransactionHistory = vitest.fn(async function* () {
        for (const tx of mockTransactions) {
          yield tx;
        }
      });

      const transactions: ShielderTransaction[] = [];
      for await (const tx of client.scanChainForTokenShielderTransactions()) {
        transactions.push(tx);
      }

      expect(transactions).toEqual(mockTransactions);
      expect(mockHistoryFetcher.getTransactionHistory).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const mockError = new Error("History error");
      mockHistoryFetcher.getTransactionHistory = vitest.fn(async function* () {
        throw mockError;
      });

      await expect(async () => {
        for await (const _ of client.scanChainForTokenShielderTransactions()) {
          // Just iterate to trigger the error
        }
      }).rejects.toThrow(mockError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        mockError,
        "syncing",
        "sync"
      );
    });
  });

  describe("getWithdrawFees", () => {
    it("should delegate to shielderActions", async () => {
      const mockFees = quotedFeesFromTotalFee(100n);
      mockShielderActions.getWithdrawFees.mockResolvedValue(mockFees);

      const fees = await client.getWithdrawFees(nativeToken(), 0n);

      expect(fees).toEqual(mockFees);
      expect(mockShielderActions.getWithdrawFees).toHaveBeenCalledWith(
        nativeToken(),
        0n
      );
    });
  });

  describe("shield", () => {
    it("should delegate to shielderActions", async () => {
      const mockAmount = 1000n;
      const mockFrom = "0x1234567890123456789012345678901234567890" as const;
      const mockTxHash = "0x9876543210" as Hash;
      const mockSendTransaction = vitest.fn().mockResolvedValue(mockTxHash);

      mockShielderActions.shield.mockResolvedValue(mockTxHash);

      const txHash = await client.shield(
        nativeToken(),
        mockAmount,
        mockSendTransaction,
        mockFrom
      );

      expect(txHash).toBe(mockTxHash);
      expect(mockShielderActions.shield).toHaveBeenCalledWith(
        nativeToken(),
        mockAmount,
        mockSendTransaction,
        mockFrom
      );
    });
  });

  describe("withdraw", () => {
    it("should delegate to shielderActions", async () => {
      const mockAmount = 1000n;
      const mockTotalFee = 100n;
      const mockAddress =
        "0x1234567890123456789012345678901234567890" as Address;
      const mockTxHash = "0x9876543210" as Hash;
      const mockPocketMoney = 0n;

      mockShielderActions.withdraw.mockResolvedValue(mockTxHash);

      const txHash = await client.withdraw(
        nativeToken(),
        mockAmount,
        quotedFeesFromTotalFee(mockTotalFee),
        mockAddress,
        mockPocketMoney
      );

      expect(txHash).toBe(mockTxHash);
      expect(mockShielderActions.withdraw).toHaveBeenCalledWith(
        nativeToken(),
        mockAmount,
        quotedFeesFromTotalFee(mockTotalFee),
        mockAddress,
        mockPocketMoney
      );
    });
  });

  describe("withdrawManual", () => {
    it("should delegate to shielderActions", async () => {
      const mockAmount = 1000n;
      const mockAddress =
        "0x1234567890123456789012345678901234567890" as Address;
      const mockFrom = "0x1234567890123456789012345678901234567890" as const;
      const mockTxHash = "0x9876543210" as Hash;
      const mockSendTransaction = vitest.fn().mockResolvedValue(mockTxHash);

      mockShielderActions.withdrawManual.mockResolvedValue(mockTxHash);

      const txHash = await client.withdrawManual(
        nativeToken(),
        mockAmount,
        mockAddress,
        mockSendTransaction,
        mockFrom
      );

      expect(txHash).toBe(mockTxHash);
      expect(mockShielderActions.withdrawManual).toHaveBeenCalledWith(
        nativeToken(),
        mockAmount,
        mockAddress,
        mockSendTransaction,
        mockFrom
      );
    });
  });
});
