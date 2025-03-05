import {
  describe,
  it,
  expect,
  vitest,
  beforeEach,
  Mocked,
  MockedFunction,
  assert
} from "vitest";

import { Address, createPublicClient, Hash, http, PublicClient } from "viem";
import { MockedCryptoClient } from "./helpers";
import {
  ShielderClient,
  ShielderCallbacks,
  createShielderClient
} from "../src/client";
import { Contract } from "../src/chain/contract";
import { Relayer } from "../src/chain/relayer";
import { idHidingNonce } from "../src/utils";
import { InjectedStorageInterface } from "../src/state/storageSchema";
import { AccountState, ShielderTransaction } from "../src/state/types";
import { contractVersion, nativeTokenAddress } from "../src/constants";
import { OutdatedSdkError } from "../src/errors";

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

import { StateSynchronizer } from "../src/state";
import { nativeToken } from "../src/types";

describe("ShielderClient", () => {
  let client: ShielderClient;
  let mockContract: Mocked<Contract>;
  let mockRelayer: Mocked<Relayer>;
  let mockPublicClient: Mocked<PublicClient>;
  let callbacks: Mocked<ShielderCallbacks>;
  let mockState: Mocked<AccountState>;
  const mockCryptoClient = new MockedCryptoClient();
  const mockedChainId = 1;
  const mockedRelayerAddress =
    "0x1234567890123456789012345678901234567890" as const;

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
    mockRelayer = {
      address: vitest.fn().mockResolvedValue(mockedRelayerAddress)
    } as unknown as Mocked<Relayer>;
    mockPublicClient = {
      waitForTransactionReceipt: vitest
        .fn()
        .mockResolvedValue({ status: "success" })
    } as unknown as Mocked<PublicClient>;

    const mockStorageInterface: InjectedStorageInterface = {
      getItem: vitest
        .fn<(key: string) => Promise<string | null>>()
        .mockResolvedValue(null),
      setItem: vitest
        .fn<(key: string, value: string) => Promise<void>>()
        .mockResolvedValue(undefined)
    };
    callbacks = {
      onCalldataGenerated: vitest.fn(),
      onCalldataSent: vitest.fn(),
      onError: vitest.fn()
    };

    // Create client instance
    client = new ShielderClient(
      mockShielderSeedPrivateKey,
      mockedChainId,
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

    mockState = {} as AccountState;

    vitest.spyOn(client["stateSynchronizer"], "syncAccountState");

    vitest
      .spyOn(client["stateManager"], "accountState")
      .mockImplementation(() => {
        return mockState;
      });
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
    let client: ShielderClient;

    beforeEach(() => {
      vitest.clearAllMocks();
      client = createShielderClient(
        mockShielderSeedPrivateKey,
        mockChainId,
        mockRpcHttpEndpoint,
        mockContractAddress,
        mockRelayerUrl,
        mockStorageInterface,
        mockCryptoClient
      );
    });

    it("should create ShielderClient with correct parameters", () => {
      expect(client).toBeInstanceOf(ShielderClient);
      expect(createPublicClient).toHaveBeenCalledOnce();
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

      client = createShielderClient(
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
      // Verify that the StateSynchronizer was created with the onNewTransaction callback
      expect(StateSynchronizer).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        mockCallbacks.onNewTransaction
      );
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
      await client.syncShielderToken(nativeTokenAddress);

      expect(
        client["stateSynchronizer"].syncAccountState
      ).toHaveBeenCalledTimes(1);
    });

    it.each([
      {
        mockedError: new Error("123"),
        name: "general error"
      },
      {
        mockedError: new OutdatedSdkError("123"),
        name: "version not supported error"
      }
    ])("error handling: $name", async ({ mockedError }) => {
      vitest
        .spyOn(client["stateSynchronizer"], "syncAccountState")
        .mockRejectedValue(mockedError);

      vitest.spyOn(callbacks, "onError");

      await expect(
        client.syncShielderToken(nativeTokenAddress)
      ).rejects.toThrow(mockedError);

      expect(callbacks.onError).toHaveBeenCalledWith(
        mockedError,
        "syncing",
        "sync"
      );
    });
  });

  describe("accountState", () => {
    it("should return current account state", async () => {
      mockState = {
        id: {} as any,
        nonce: 1n,
        balance: 1000n,
        currentNote: {} as any,
        token: nativeToken()
      };

      const state = await client.accountState(nativeTokenAddress);

      expect(state).toEqual(mockState);
    });
  });

  describe("scanChainForShielderTransactions", () => {
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
      vitest
        .spyOn(client["stateSynchronizer"], "getShielderTransactions")
        .mockImplementation(async function* () {
          for (const tx of mockTransactions) {
            yield tx;
          }
        });

      const transactions: ShielderTransaction[] = [];
      for await (const tx of client.scanChainForTokenShielderTransactions(
        nativeTokenAddress
      )) {
        transactions.push(tx);
      }

      expect(transactions).toEqual(mockTransactions);
    });
  });

  describe("actions", () => {
    const mockAmount = 1000n;
    const mockFrom = "0x1234567890123456789012345678901234567890" as const;
    const mockTxHash = "0x9876543210" as Hash;
    const mockTotalFee = 100n;
    const mockAddress = "0x1234567890123456789012345678901234567890" as Address;

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

    beforeEach(() => {
      for (const action of [
        "newAccountAction",
        "depositAction",
        "withdrawAction"
      ]) {
        vitest
          .spyOn(client[action], "generateCalldata")
          .mockResolvedValue({} as any);
        vitest
          .spyOn(client[action], "sendCalldata")
          .mockResolvedValue(mockTxHash);
        if (action === "withdrawAction") {
          vitest
            .spyOn(client[action], "sendCalldataWithRelayer")
            .mockResolvedValue(mockTxHash);
        }
      }
    });
    describe("shield", () => {
      it.each([
        {
          nonce: 0n,
          action: "newAccountAction"
        },
        {
          nonce: 1n,
          action: "depositAction"
        }
      ])(
        "should call $action when nonce is $nonce",
        async ({ nonce, action }) => {
          mockState = { nonce } as AccountState;

          const txHash = await client.shield(
            nativeTokenAddress,
            mockAmount,
            mockSendTransaction,
            mockFrom
          );

          expect(txHash).toBe(mockTxHash);
          expect(
            mockPublicClient.waitForTransactionReceipt
          ).toHaveBeenCalledWith({
            hash: mockTxHash
          });
          expect(client[action].generateCalldata).toHaveBeenCalledWith(
            mockState,
            mockAmount,
            contractVersion
          );
          expect(callbacks.onCalldataGenerated).toHaveBeenCalledWith(
            expect.any(Object),
            "shield"
          );
          expect(client[action].sendCalldata).toHaveBeenCalledWith(
            expect.any(Object),
            mockSendTransaction,
            mockFrom
          );
          expect(callbacks.onCalldataSent).toHaveBeenCalledWith(
            mockTxHash,
            "shield"
          );
          expect(
            client["stateSynchronizer"].syncAccountState
          ).toHaveBeenCalledTimes(1);
        }
      );
    });

    describe("withdraw", () => {
      it("should successfully withdraw funds", async () => {
        // Mock state
        mockState = { nonce: 1n } as AccountState;

        const txHash = await client.withdraw(
          nativeTokenAddress,
          mockAmount,
          mockTotalFee,
          mockAddress
        );

        expect(txHash).toBe(mockTxHash);
        expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
          {
            hash: mockTxHash
          }
        );
        expect(client["withdrawAction"].generateCalldata).toHaveBeenCalledWith(
          mockState,
          mockAmount,
          mockedRelayerAddress,
          mockTotalFee,
          mockAddress,
          contractVersion
        );
        expect(callbacks.onCalldataGenerated).toHaveBeenCalledWith(
          expect.any(Object),
          "withdraw"
        );
        expect(
          client["withdrawAction"].sendCalldataWithRelayer
        ).toHaveBeenCalledWith(expect.any(Object));
        expect(callbacks.onCalldataSent).toHaveBeenCalledWith(
          mockTxHash,
          "withdraw"
        );
        expect(
          client["stateSynchronizer"].syncAccountState
        ).toHaveBeenCalledTimes(1);
      });
    });

    describe("version error handling", () => {
      it.each([
        {
          mockedError: new OutdatedSdkError("123"),
          action: "newAccountAction",
          stage: "generateCalldata",
          clientTarget: "shield",
          nonce: 0n
        },
        {
          mockedError: new OutdatedSdkError("123"),
          action: "depositAction",
          stage: "generateCalldata",
          clientTarget: "shield",
          nonce: 1n
        },
        {
          mockedError: new OutdatedSdkError("123"),
          action: "newAccountAction",
          stage: "sendCalldata",
          clientTarget: "shield",
          nonce: 0n
        },
        {
          mockedError: new OutdatedSdkError("123"),
          action: "depositAction",
          stage: "sendCalldata",
          clientTarget: "shield",
          nonce: 1n
        },
        {
          mockedError: new OutdatedSdkError("123"),
          action: "withdrawAction",
          stage: "sendCalldataWithRelayer",
          clientTarget: "withdraw",
          nonce: 1n
        }
      ])(
        "should throw OutdatedSdkError when version is not supported",
        async ({ mockedError, action, stage, clientTarget, nonce }) => {
          // Mock state
          mockState = { nonce } as AccountState;

          vitest.spyOn(client[action], stage).mockRejectedValue(mockedError);

          vitest.spyOn(callbacks, "onError");

          await expect(
            client[clientTarget](mockAmount, mockSendTransaction, mockFrom)
          ).rejects.toThrow(mockedError);

          if (stage === "sendCalldata" || stage === "sendCalldataWithRelayer") {
            expect(callbacks.onCalldataGenerated).toHaveBeenCalledWith(
              expect.any(Object),
              clientTarget
            );
          }

          expect(callbacks.onError).toHaveBeenCalledWith(
            mockedError,
            stage === "generateCalldata" ? "generation" : "sending",
            clientTarget
          );
        }
      );
    });
  });
});
