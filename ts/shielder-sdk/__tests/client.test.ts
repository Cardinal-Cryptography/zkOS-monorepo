import {
  describe,
  it,
  expect,
  vitest,
  beforeEach,
  Mocked,
  Mock,
  MockedFunction
} from "vitest";

import {
  Address,
  createPublicClient,
  defineChain,
  Hash,
  PublicClient
} from "viem";
import { MockedCryptoClient } from "./helpers";
import {
  ShielderClient,
  OutdatedSdkError,
  ShielderCallbacks,
  createShielderClient
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

vitest.mock("../src/chain/contract");
vitest.mock("../src/chain/relayer");
vitest.mock("../src/state");
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
  let mockStorage: ReturnType<typeof createStorage>;
  let callbacks: Mocked<ShielderCallbacks>;
  const mockCryptoClient = new MockedCryptoClient();

  const mockShielderSeedPrivateKey =
    "0x1234567890123456789012345678901234567890123456789012345678901234" as const;

  beforeEach(() => {
    // Reset mocks
    vitest.clearAllMocks();

    // Setup mocks
    mockContract = new Contract(
      null as any,
      "0x" as Address
    ) as Mocked<Contract>;
    mockRelayer = new Relayer("http://localhost") as Mocked<Relayer>;
    mockPublicClient = {
      waitForTransactionReceipt: vitest.fn()
    } as unknown as Mocked<PublicClient>;

    const mockStorageInterface: InjectedStorageInterface = {
      getItem: vitest
        .fn<(key: string) => Promise<string | null>>()
        .mockResolvedValue(null),
      setItem: vitest
        .fn<(key: string, value: string) => Promise<void>>()
        .mockResolvedValue(undefined)
    };
    mockStorage = createStorage(mockStorageInterface);
    callbacks = {
      onCalldataGenerated: vitest.fn(),
      onCalldataSent: vitest.fn(),
      onError: vitest.fn()
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

  describe("createShielderClient", () => {
    const mockShielderSeedPrivateKey =
      "0x1234567890123456789012345678901234567890123456789012345678901234" as const;
    const mockChainId = 1;
    const mockRpcHttpEndpoint = "http://localhost:8545";
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

    beforeEach(() => {
      vitest.clearAllMocks();
    });

    it("should create ShielderClient with correct parameters", () => {
      const client = createShielderClient(
        mockShielderSeedPrivateKey,
        mockChainId,
        mockRpcHttpEndpoint,
        mockContractAddress,
        mockRelayerUrl,
        mockStorageInterface,
        mockCryptoClient
      );

      expect(client).toBeInstanceOf(ShielderClient);
      expect(createPublicClient).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: expect.objectContaining({
            id: mockChainId,
            rpcUrls: expect.objectContaining({
              default: {
                http: [mockRpcHttpEndpoint]
              }
            })
          })
        })
      );
      expect(Contract).toHaveBeenCalledWith(
        expect.anything(),
        mockContractAddress
      );
      expect(Relayer).toHaveBeenCalledWith(mockRelayerUrl);
    });

    it("should create ShielderClient with default callbacks", () => {
      const client = createShielderClient(
        mockShielderSeedPrivateKey,
        mockChainId,
        mockRpcHttpEndpoint,
        mockContractAddress,
        mockRelayerUrl,
        mockStorageInterface,
        mockCryptoClient
      );

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

      const client = createShielderClient(
        mockShielderSeedPrivateKey,
        mockChainId,
        mockRpcHttpEndpoint,
        mockContractAddress,
        mockRelayerUrl,
        mockStorageInterface,
        mockCryptoClient,
        mockCallbacks
      );

      expect(client).toBeInstanceOf(ShielderClient);
      // Verify that the client was created with the provided callbacks
      expect(client["callbacks"]).toEqual(mockCallbacks);
    });
  });

  describe("getWithdrawFees", () => {
    it("should return quoted fees from relayer", async () => {
      const mockFees = {
        base_fee: 1000n,
        relay_fee: 500n,
        total_fee: 1500n
      };

      mockRelayer.quoteFees = vitest
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
      vitest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockImplementationOnce(async () => {});

      await client.syncShielder();

      expect(
        client["stateSynchronizer"].syncAccountState
      ).toHaveBeenCalledTimes(1);
    });

    it("should throw OutdatedSdkError when version is not supported", async () => {
      vitest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockRejectedValue(new UnexpectedVersionInEvent("123"));

      // spy on client.callbacks.onError callback
      vitest.spyOn(callbacks, "onError");

      await expect(client.syncShielder()).rejects.toThrow(OutdatedSdkError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        new OutdatedSdkError(),
        "syncing",
        "sync"
      );
    });

    it("should rethrow general error", async () => {
      const mockedError = new Error("123");
      vitest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockRejectedValue(mockedError);

      // spy on client.callbacks.onError callback
      vitest.spyOn(callbacks, "onError");

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
      vitest
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
      vitest
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

    it("should rethrow general error", async () => {
      const mockedError = new Error("123");
      vitest
        .spyOn(client["stateSynchronizer"], "getShielderTransactions")
        .mockImplementation(async function* () {
          throw mockedError;
        });
      vitest.spyOn(callbacks, "onError");

      await expect(async () => {
        for await (const _ of client.scanChainForShielderTransactions()) {
          // Should throw before yielding any transactions
        }
      }).rejects.toThrow(mockedError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        mockedError,
        "syncing",
        "sync"
      );
    });

    it("should throw OutdatedSdkError when version is not supported", async () => {
      vitest
        .spyOn(client["stateSynchronizer"], "getShielderTransactions")
        .mockImplementation(async function* () {
          throw new UnexpectedVersionInEvent("123");
        });

      // spy on client.callbacks.onError callback
      vitest.spyOn(callbacks, "onError");

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
    const mockSendTransaction = vitest
      .fn<
        (params: {
          data: `0x${string}`;
          to: `0x${string}`;
          value: bigint;
        }) => Promise<Hash>
      >()
      .mockResolvedValue(mockTxHash) as MockedFunction<
      (params: {
        data: `0x${string}`;
        to: `0x${string}`;
        value: bigint;
      }) => Promise<Hash>
    >;

    it("should create new account when nonce is 0", async () => {
      // Mock state with nonce 0
      const mockState = { nonce: 0n } as AccountState;
      vitest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      vitest
        .spyOn(client["newAccountAction"], "generateCalldata")
        .mockResolvedValue({} as any);

      vitest
        .spyOn(client["newAccountAction"], "sendCalldata")
        .mockResolvedValue(mockTxHash);

      vitest
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

      vitest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      vitest
        .spyOn(client["depositAction"], "generateCalldata")
        .mockResolvedValue({} as any);

      vitest
        .spyOn(client["depositAction"], "sendCalldata")
        .mockResolvedValue(mockTxHash);

      vitest
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
      vitest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      vitest
        .spyOn(client["newAccountAction"], "generateCalldata")
        .mockRejectedValue(new VersionRejectedByContract());

      await expect(
        client.shield(mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(OutdatedSdkError);
    });

    it("should throw OutdatedSdkError when version is not supported on deposit", async () => {
      // Mock state
      const mockState = { nonce: 1n } as AccountState;
      vitest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      vitest
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
      vitest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      // Mock withdraw action
      vitest
        .spyOn(client["withdrawAction"], "generateCalldata")
        .mockResolvedValue({} as any);
      vitest
        .spyOn(client["withdrawAction"], "sendCalldata")
        .mockResolvedValue(mockTxHash);

      vitest
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
      vitest
        .spyOn(client["stateManager"], "accountState")
        .mockResolvedValue(mockState);

      // Mock withdraw action
      vitest
        .spyOn(client["withdrawAction"], "generateCalldata")
        .mockResolvedValue({} as any);

      vitest
        .spyOn(client["withdrawAction"], "sendCalldata")
        .mockRejectedValue(new VersionRejectedByContract());

      await expect(
        client.withdraw(mockAmount, mockTotalFee, mockAddress)
      ).rejects.toThrow(OutdatedSdkError);
    });
  });
});
