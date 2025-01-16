import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { Address, Hash, PublicClient } from "viem";
import { MockedCryptoClient } from "./helpers";
import {
  ShielderClient,
  OutdatedSdkError,
  ShielderCallbacks
} from "../src/client";
import {
  Contract,
  NoteEvent,
  VersionRejectedByContract
} from "../src/chain/contract";
import { Relayer, VersionRejectedByRelayer } from "../src/chain/relayer";
import { createStorage, UnexpectedVersionInEvent } from "../src/state";
import { idHidingNonce } from "../src/utils";
import { InjectedStorageInterface } from "../src/state/storageSchema";
import { AccountState, ShielderTransaction } from "../src/state/types";
import { contractVersion } from "../src/constants";

// Mock dependencies
jest.mock("viem");
jest.mock("../src/chain/contract");
jest.mock("../src/chain/relayer");
jest.mock("../src/state");

describe("ShielderClient", () => {
  let client: ShielderClient;
  let mockContract: jest.Mocked<Contract>;
  let mockRelayer: jest.Mocked<Relayer>;
  let mockPublicClient: jest.Mocked<PublicClient>;
  let mockStorage: ReturnType<typeof createStorage>;
  let callbacks: jest.Mocked<ShielderCallbacks>;
  const mockCryptoClient = new MockedCryptoClient();

  const mockShielderSeedPrivateKey =
    "0x1234567890123456789012345678901234567890123456789012345678901234" as const;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockContract = new Contract(
      null as any,
      "0x" as Address
    ) as jest.Mocked<Contract>;
    mockRelayer = new Relayer("http://localhost") as jest.Mocked<Relayer>;
    mockPublicClient = {
      waitForTransactionReceipt: jest.fn()
    } as unknown as jest.Mocked<PublicClient>;

    const mockStorageInterface: InjectedStorageInterface = {
      getItem: jest
        .fn<(key: string) => Promise<string | null>>()
        .mockResolvedValue(null),
      setItem: jest
        .fn<(key: string, value: string) => Promise<void>>()
        .mockResolvedValue(undefined)
    };
    mockStorage = createStorage(mockStorageInterface);
    callbacks = {
      onCalldataGenerated: jest.fn(),
      onCalldataSent: jest.fn(),
      onError: jest.fn()
    };

    // Create client instance
    client = new ShielderClient(
      mockShielderSeedPrivateKey,
      mockContract,
      mockRelayer,
      mockStorageInterface,
      mockPublicClient,
      mockCryptoClient,
      {
        randomIdHidingNonce: () => idHidingNonce()
      },
      callbacks
    );
  });

  describe("getWithdrawFees", () => {
    it("should return quoted fees from relayer", async () => {
      const mockFees = {
        base_fee: 1000n,
        relay_fee: 500n,
        total_fee: 1500n
      };

      mockRelayer.quoteFees = jest
        .fn<
          () => Promise<{
            base_fee: bigint;
            relay_fee: bigint;
            total_fee: bigint;
          }>
        >()
        .mockResolvedValue(mockFees);

      const fees = await client.getWithdrawFees();

      expect(fees).toEqual({
        baseFee: mockFees.base_fee,
        relayFee: mockFees.relay_fee,
        totalFee: mockFees.total_fee
      });
      expect(mockRelayer.quoteFees).toHaveBeenCalledTimes(1);
    });
  });

  describe("syncShielder", () => {
    it("should call stateSynchronizer", async () => {
      jest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockImplementationOnce(async () => {});

      await client.syncShielder();

      expect(
        client["stateSynchronizer"].syncAccountState
      ).toHaveBeenCalledTimes(1);
    });

    it("should throw OutdatedSdkError when version is not supported", async () => {
      jest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockRejectedValue(new UnexpectedVersionInEvent("123"));

      // spy on client.callbacks.onError callback
      jest.spyOn(callbacks, "onError");

      await expect(client.syncShielder()).rejects.toThrow(OutdatedSdkError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        new OutdatedSdkError(),
        "syncing",
        "sync"
      );
    });

    it("should rethrow general error", async () => {
      const mockedError = new Error("123");
      jest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockRejectedValue(mockedError);

      // spy on client.callbacks.onError callback
      jest.spyOn(callbacks, "onError");

      await expect(client.syncShielder()).rejects.toThrow(mockedError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        mockedError,
        "syncing",
        "sync"
      );
    });
  });

  describe("accountState", () => {
    it("should return current account state", async () => {
      const mockState: AccountState = {
        id: {} as any,
        nonce: 1n,
        balance: 1000n,
        currentNote: {} as any,
        storageSchemaVersion: 1
      };
      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      const state = await client.accountState();

      expect(state).toEqual(mockState);
    });
  });

  describe("scanChainForShielderTransactions", () => {
    it("should yield transactions successfully", async () => {
      const mockTransactions: ShielderTransaction[] = [
        {
          type: "NewAccountNative",
          amount: 1000n,
          txHash: "0x123" as Hash,
          block: 1n
        },
        {
          type: "DepositNative",
          amount: 2000n,
          txHash: "0x456" as Hash,
          block: 2n
        }
      ];
      jest
        .spyOn(client["stateSynchronizer"], "getShielderTransactions")
        .mockImplementation(async function* () {
          for (const tx of mockTransactions) {
            yield tx;
          }
        });

      const transactions: ShielderTransaction[] = [];
      for await (const tx of client.scanChainForShielderTransactions()) {
        transactions.push(tx);
      }

      expect(transactions).toEqual(mockTransactions);
    });

    it("should throw OutdatedSdkError when version is not supported", async () => {
      jest
        .spyOn(client["stateSynchronizer"], "getShielderTransactions")
        .mockImplementation(async function* () {
          throw new UnexpectedVersionInEvent("123");
        });

      // spy on client.callbacks.onError callback
      jest.spyOn(callbacks, "onError");

      await expect(async () => {
        for await (const _ of client.scanChainForShielderTransactions()) {
          // Should throw before yielding any transactions
        }
      }).rejects.toThrow(OutdatedSdkError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        new OutdatedSdkError(),
        "syncing",
        "sync"
      );
    });
  });

  describe("shield", () => {
    const mockAmount = 1000n;
    const mockFrom = "0x1234567890123456789012345678901234567890" as const;
    const mockTxHash = "0x9876543210" as Hash;
    const mockSendTransaction = jest
      .fn<
        (params: {
          data: `0x${string}`;
          to: `0x${string}`;
          value: bigint;
        }) => Promise<Hash>
      >()
      .mockResolvedValue(mockTxHash) as jest.MockedFunction<
      (params: {
        data: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
      }) => Promise<Hash>
    >;

    it("should create new account when nonce is 0", async () => {
      // Mock state with nonce 0
      const mockState = { nonce: 0n } as AccountState;
      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      jest
        .spyOn(client["newAccountAction"], "generateCalldata")
        .mockResolvedValue({} as any);

      jest
        .spyOn(client["newAccountAction"], "sendCalldata")
        .mockResolvedValue(mockTxHash);

      jest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockImplementation(async () => {});

      const txHash = await client.shield(
        mockAmount,
        mockSendTransaction,
        mockFrom
      );

      expect(txHash).toBe(mockTxHash);
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      // check that newAccountAction.generateCalldata was called with the correct arguments
      expect(client["newAccountAction"].generateCalldata).toHaveBeenCalledWith(
        mockState,
        mockAmount,
        contractVersion
      );
      // check that newAccountAction.sendCalldata was called with the correct arguments
      expect(client["newAccountAction"].sendCalldata).toHaveBeenCalledWith(
        expect.any(Object),
        mockSendTransaction,
        mockFrom
      );
      // shielder.sync() should be called after the transaction is sent
      expect(
        client["stateSynchronizer"].syncAccountState
      ).toHaveBeenCalledTimes(1);
    });

    it("should deposit when nonce is not 0", async () => {
      // Mock state with non-zero nonce
      const mockState = { nonce: 1n } as AccountState;

      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      jest
        .spyOn(client["depositAction"], "generateCalldata")
        .mockResolvedValue({} as any);

      jest
        .spyOn(client["depositAction"], "sendCalldata")
        .mockResolvedValue(mockTxHash);

      jest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockImplementation(async () => {});

      const txHash = await client.shield(
        mockAmount,
        mockSendTransaction,
        mockFrom
      );

      expect(txHash).toBe(mockTxHash);
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      // check that depositAction.generateCalldata was called with the correct arguments
      expect(client["depositAction"].generateCalldata).toHaveBeenCalledWith(
        mockState,
        mockAmount,
        contractVersion
      );
      // check that depositAction.sendCalldata was called with the correct arguments
      expect(client["depositAction"].sendCalldata).toHaveBeenCalledWith(
        expect.any(Object),
        mockSendTransaction,
        mockFrom
      );
      // shielder.sync() should be called after the transaction is sent
      expect(
        client["stateSynchronizer"].syncAccountState
      ).toHaveBeenCalledTimes(1);
    });

    it("should throw OutdatedSdkError when version is not supported on newAccount", async () => {
      // Mock state
      const mockState = { nonce: 0n } as AccountState;
      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      jest
        .spyOn(client["newAccountAction"], "generateCalldata")
        .mockRejectedValue(new VersionRejectedByContract());

      await expect(
        client.shield(mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(OutdatedSdkError);
    });

    it("should throw OutdatedSdkError when version is not supported on deposit", async () => {
      // Mock state
      const mockState = { nonce: 1n } as AccountState;
      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      jest
        .spyOn(client["depositAction"], "generateCalldata")
        .mockRejectedValue(new VersionRejectedByContract());

      await expect(
        client.shield(mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(OutdatedSdkError);
    });
  });

  describe("withdraw", () => {
    const mockAmount = 1000n;
    const mockTotalFee = 100n;
    const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
    const mockTxHash = "0x9876543210" as Hash;

    it("should successfully withdraw funds", async () => {
      // Mock state
      const mockState = { nonce: 1n } as AccountState;
      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      // Mock withdraw action
      jest
        .spyOn(client["withdrawAction"], "generateCalldata")
        .mockResolvedValue({} as any);
      jest
        .spyOn(client["withdrawAction"], "sendCalldata")
        .mockResolvedValue(mockTxHash);

      jest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockImplementation(async () => {});

      const txHash = await client.withdraw(
        mockAmount,
        mockTotalFee,
        mockAddress
      );

      expect(txHash).toBe(mockTxHash);
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      // check that withdrawAction.generateCalldata was called with the correct arguments
      expect(client["withdrawAction"].generateCalldata).toHaveBeenCalledWith(
        mockState,
        mockAmount,
        mockTotalFee,
        mockAddress,
        contractVersion
      );
      // check that withdrawAction.sendCalldata was called with the correct arguments
      expect(client["withdrawAction"].sendCalldata).toHaveBeenCalledWith(
        expect.any(Object)
      );
      // shielder.sync() should be called after the transaction is sent
      expect(
        client["stateSynchronizer"].syncAccountState
      ).toHaveBeenCalledTimes(1);
    });

    it("should throw OutdatedSdkError when version is not supported", async () => {
      // Mock state
      const mockState = { nonce: 1n } as AccountState;
      jest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      // Mock withdraw action
      jest
        .spyOn(client["withdrawAction"], "generateCalldata")
        .mockResolvedValue({} as any);

      jest
        .spyOn(client["withdrawAction"], "sendCalldata")
        .mockRejectedValue(new VersionRejectedByContract());

      await expect(
        client.withdraw(mockAmount, mockTotalFee, mockAddress)
      ).rejects.toThrow(OutdatedSdkError);
    });
  });
});
