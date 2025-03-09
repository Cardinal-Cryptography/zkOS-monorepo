import { describe, it, expect, vitest, beforeEach, Mocked } from "vitest";

import { Address, Hash, PublicClient } from "viem";
import { ShielderActions } from "../../src/client/actions";
import {
  SendShielderTransaction,
  ShielderCallbacks,
  ShielderOperation
} from "../../src/client/types";
import { AccountRegistry } from "../../src/state/accountRegistry";
import { StateSynchronizer } from "../../src/state/sync/synchronizer";
import { IRelayer } from "../../src/chain/relayer";
import { NewAccountAction } from "../../src/actions/newAccount";
import { DepositAction } from "../../src/actions/deposit";
import { WithdrawAction } from "../../src/actions/withdraw";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { NativeToken } from "../../src/types";
import { nativeToken } from "../../src/utils";
import { contractVersion } from "../../src/constants";
import { OutdatedSdkError } from "../../src/errors";
import { NewAccountCalldata } from "../../src/actions/newAccount";
import { DepositCalldata } from "../../src/actions/deposit";
import { WithdrawCalldata } from "../../src/actions/withdraw";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";

describe("ShielderActions", () => {
  // Test fixtures and mocks
  let actions: ShielderActions;
  let mockAccountRegistry: Mocked<AccountRegistry>;
  let mockStateSynchronizer: Mocked<StateSynchronizer>;
  let mockRelayer: Mocked<IRelayer>;
  let mockNewAccountAction: Mocked<NewAccountAction>;
  let mockDepositAction: Mocked<DepositAction>;
  let mockWithdrawAction: Mocked<WithdrawAction>;
  let mockPublicClient: Mocked<PublicClient>;
  let mockCallbacks: ShielderCallbacks;
  let mockAccountState: AccountStateMerkleIndexed;

  // Common test values
  const mockToken: NativeToken = nativeToken();
  const mockAmount = 1000n;
  const mockTotalFee = 100n;
  const mockAddress = "0x1234567890123456789012345678901234567890" as Address;
  const mockFrom = "0x1234567890123456789012345678901234567890" as Address;
  const mockTxHash = "0x9876543210" as Hash;
  const mockRelayerAddress =
    "0x1234567890123456789012345678901234567890" as Address;

  const mockSendTransaction: SendShielderTransaction = vitest
    .fn()
    .mockResolvedValue(mockTxHash);

  // Helper functions for creating mock calldata objects
  const createMockNewAccountCalldata = (): NewAccountCalldata => ({
    calldata: {
      pubInputs: {
        hNote: Scalar.fromBigint(0n),
        hId: Scalar.fromBigint(0n),
        initialDeposit: Scalar.fromBigint(0n),
        tokenAddress: Scalar.fromBigint(0n),
        anonymityRevokerPublicKeyX: Scalar.fromBigint(0n),
        anonymityRevokerPublicKeyY: Scalar.fromBigint(0n),
        symKeyEncryption1X: Scalar.fromBigint(0n),
        symKeyEncryption1Y: Scalar.fromBigint(0n),
        symKeyEncryption2X: Scalar.fromBigint(0n),
        symKeyEncryption2Y: Scalar.fromBigint(0n)
      },
      proof: new Uint8Array()
    },
    expectedContractVersion: contractVersion,
    provingTimeMillis: 100,
    amount: mockAmount,
    token: mockToken
  });

  const createMockDepositCalldata = (): DepositCalldata => ({
    calldata: {
      pubInputs: {
        idHiding: Scalar.fromBigint(0n),
        merkleRoot: Scalar.fromBigint(0n),
        hNullifierOld: Scalar.fromBigint(0n),
        hNoteNew: Scalar.fromBigint(0n),
        value: Scalar.fromBigint(0n),
        tokenAddress: Scalar.fromBigint(0n),
        macSalt: Scalar.fromBigint(0n),
        macCommitment: Scalar.fromBigint(0n)
      },
      proof: new Uint8Array()
    },
    expectedContractVersion: contractVersion,
    provingTimeMillis: 100,
    amount: mockAmount,
    token: mockToken
  });

  const createMockWithdrawCalldata = (
    totalFee = mockTotalFee
  ): WithdrawCalldata => ({
    calldata: {
      pubInputs: {
        idHiding: Scalar.fromBigint(0n),
        merkleRoot: Scalar.fromBigint(0n),
        hNullifierOld: Scalar.fromBigint(0n),
        hNoteNew: Scalar.fromBigint(0n),
        value: Scalar.fromBigint(0n),
        tokenAddress: Scalar.fromBigint(0n),
        commitment: Scalar.fromBigint(0n),
        macSalt: Scalar.fromBigint(0n),
        macCommitment: Scalar.fromBigint(0n)
      },
      proof: new Uint8Array()
    },
    expectedContractVersion: contractVersion,
    provingTimeMillis: 100,
    amount: mockAmount,
    withdrawalAddress: mockAddress,
    totalFee,
    token: mockToken
  });

  // Helper function for testing error scenarios
  const testErrorHandling = async (
    operation: ShielderOperation,
    errorType: "generation" | "sending",
    method: () => Promise<Hash>,
    mockGenerateCalldata: any,
    mockSendCalldata: any,
    mockCalldata: any
  ) => {
    const mockError = new Error(
      `Failed to ${errorType === "generation" ? "generate" : "send"} calldata`
    );

    if (errorType === "generation") {
      mockGenerateCalldata.mockRejectedValueOnce(mockError);
    } else {
      mockGenerateCalldata.mockResolvedValueOnce(mockCalldata);
      mockSendCalldata.mockRejectedValueOnce(mockError);
    }

    await expect(method()).rejects.toThrow(mockError);

    expect(mockCallbacks.onError).toHaveBeenCalledWith(
      mockError,
      errorType,
      operation
    );

    if (errorType === "sending") {
      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        operation
      );
    } else {
      expect(mockCallbacks.onCalldataGenerated).not.toHaveBeenCalled();
    }

    expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
  };

  // Helper function for testing OutdatedSdkError
  const testOutdatedSdkError = async (
    operation: ShielderOperation,
    method: () => Promise<Hash>,
    mockGenerateCalldata: any
  ) => {
    const mockError = new OutdatedSdkError("Outdated SDK version");
    mockGenerateCalldata.mockRejectedValueOnce(mockError);

    await expect(method()).rejects.toThrow(mockError);

    expect(mockCallbacks.onError).toHaveBeenCalledWith(
      mockError,
      "generation",
      operation
    );
  };

  // Helper function for testing transaction failure
  const testTransactionFailure = async (
    method: () => Promise<Hash>,
    mockGenerateCalldata: any,
    mockSendCalldata: any,
    mockCalldata: any
  ) => {
    mockGenerateCalldata.mockResolvedValueOnce(mockCalldata);
    mockSendCalldata.mockResolvedValueOnce(mockTxHash);
    mockPublicClient.waitForTransactionReceipt.mockResolvedValueOnce({
      status: "reverted",
      blockHash: "0x123" as `0x${string}`,
      blockNumber: 1n,
      contractAddress: null,
      cumulativeGasUsed: 1000n,
      effectiveGasPrice: 1000n,
      from: "0x123" as `0x${string}`,
      gasUsed: 1000n,
      logs: [],
      logsBloom: "0x123" as `0x${string}`,
      to: "0x123" as `0x${string}`,
      transactionHash: "0x123" as `0x${string}`,
      transactionIndex: 0,
      type: "eip1559"
    });

    await expect(method()).rejects.toThrow("Transaction failed");

    expect(mockStateSynchronizer.syncSingleAccount).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    // Reset mocks
    vitest.clearAllMocks();

    // Setup mocks
    mockAccountRegistry = {
      getAccountState: vitest.fn(),
      createEmptyAccountState: vitest.fn()
    } as unknown as Mocked<AccountRegistry>;

    mockStateSynchronizer = {
      syncSingleAccount: vitest.fn().mockResolvedValue([])
    } as unknown as Mocked<StateSynchronizer>;

    mockRelayer = {
      quoteFees: vitest.fn(),
      address: vitest.fn().mockResolvedValue(mockRelayerAddress)
    } as unknown as Mocked<IRelayer>;

    mockNewAccountAction = {
      generateCalldata: vitest.fn(),
      sendCalldata: vitest.fn()
    } as unknown as Mocked<NewAccountAction>;

    mockDepositAction = {
      generateCalldata: vitest.fn(),
      sendCalldata: vitest.fn()
    } as unknown as Mocked<DepositAction>;

    mockWithdrawAction = {
      generateCalldata: vitest.fn(),
      sendCalldata: vitest.fn(),
      sendCalldataWithRelayer: vitest.fn()
    } as unknown as Mocked<WithdrawAction>;

    mockPublicClient = {
      waitForTransactionReceipt: vitest.fn().mockResolvedValue({
        status: "success"
      })
    } as unknown as Mocked<PublicClient>;

    mockCallbacks = {
      onCalldataGenerated: vitest.fn(),
      onCalldataSent: vitest.fn(),
      onError: vitest.fn()
    };

    // Setup mock account state
    mockAccountState = {
      id: Scalar.fromBigint(123n),
      nonce: 1n,
      balance: 1000n,
      token: mockToken,
      currentNote: Scalar.fromBigint(456n),
      currentNoteIndex: 0n
    } as AccountStateMerkleIndexed;

    mockAccountRegistry.getAccountState.mockResolvedValue(mockAccountState);

    // Create ShielderActions instance
    actions = new ShielderActions(
      mockAccountRegistry,
      mockStateSynchronizer,
      mockRelayer,
      mockNewAccountAction,
      mockDepositAction,
      mockWithdrawAction,
      mockPublicClient,
      mockCallbacks
    );
  });

  describe("getWithdrawFees", () => {
    it("should return quoted fees from relayer", async () => {
      const mockFees = {
        base_fee: 1000n,
        relay_fee: 500n,
        total_fee: 1500n
      };

      mockRelayer.quoteFees.mockResolvedValue(mockFees);

      const fees = await actions.getWithdrawFees();

      expect(fees).toEqual({
        baseFee: mockFees.base_fee,
        relayFee: mockFees.relay_fee,
        totalFee: mockFees.total_fee
      });
      expect(mockRelayer.quoteFees).toHaveBeenCalledTimes(1);
    });
  });

  describe("shield", () => {
    const shieldMethod = () =>
      actions.shield(mockToken, mockAmount, mockSendTransaction, mockFrom);

    describe("new account creation", () => {
      beforeEach(() => {
        // Setup for new account creation
        mockAccountState.nonce = 0n;
        mockAccountRegistry.getAccountState.mockResolvedValue(null);
        mockAccountRegistry.createEmptyAccountState.mockResolvedValue(
          mockAccountState
        );
      });

      it("should create a new account when nonce is 0", async () => {
        const mockCalldata = createMockNewAccountCalldata();
        mockNewAccountAction.generateCalldata.mockResolvedValue(mockCalldata);
        mockNewAccountAction.sendCalldata.mockResolvedValue(mockTxHash);

        const txHash = await shieldMethod();

        expect(txHash).toBe(mockTxHash);
        expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
          mockToken
        );
        expect(mockNewAccountAction.generateCalldata).toHaveBeenCalledWith(
          mockAccountState,
          mockAmount,
          contractVersion
        );
        expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
          mockCalldata,
          "shield"
        );
        expect(mockNewAccountAction.sendCalldata).toHaveBeenCalledWith(
          mockCalldata,
          mockSendTransaction,
          mockFrom
        );
        expect(mockCallbacks.onCalldataSent).toHaveBeenCalledWith(
          mockTxHash,
          "shield"
        );
        expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
          {
            hash: mockTxHash
          }
        );
        expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
          mockToken
        );
      });

      it("should handle calldata generation errors", async () => {
        await testErrorHandling(
          "shield",
          "generation",
          shieldMethod,
          mockNewAccountAction.generateCalldata,
          mockNewAccountAction.sendCalldata,
          createMockNewAccountCalldata()
        );
      });

      it("should handle calldata sending errors", async () => {
        await testErrorHandling(
          "shield",
          "sending",
          shieldMethod,
          mockNewAccountAction.generateCalldata,
          mockNewAccountAction.sendCalldata,
          createMockNewAccountCalldata()
        );
      });

      it("should handle OutdatedSdkError during calldata generation", async () => {
        await testOutdatedSdkError(
          "shield",
          shieldMethod,
          mockNewAccountAction.generateCalldata
        );
      });

      it("should throw error when transaction fails", async () => {
        await testTransactionFailure(
          shieldMethod,
          mockNewAccountAction.generateCalldata,
          mockNewAccountAction.sendCalldata,
          createMockNewAccountCalldata()
        );
      });
    });

    describe("deposit to existing account", () => {
      beforeEach(() => {
        // Setup for deposit to existing account
        mockAccountState.nonce = 1n;
        mockAccountRegistry.getAccountState.mockResolvedValue(mockAccountState);
      });

      it("should deposit to existing account when nonce is not 0", async () => {
        const mockCalldata = createMockDepositCalldata();
        mockDepositAction.generateCalldata.mockResolvedValue(mockCalldata);
        mockDepositAction.sendCalldata.mockResolvedValue(mockTxHash);

        const txHash = await shieldMethod();

        expect(txHash).toBe(mockTxHash);
        expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
          mockToken
        );
        expect(mockDepositAction.generateCalldata).toHaveBeenCalledWith(
          mockAccountState,
          mockAmount,
          contractVersion
        );
        expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
          mockCalldata,
          "shield"
        );
        expect(mockDepositAction.sendCalldata).toHaveBeenCalledWith(
          mockCalldata,
          mockSendTransaction,
          mockFrom
        );
        expect(mockCallbacks.onCalldataSent).toHaveBeenCalledWith(
          mockTxHash,
          "shield"
        );
        expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
          {
            hash: mockTxHash
          }
        );
        expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
          mockToken
        );
      });

      it("should handle calldata generation errors", async () => {
        await testErrorHandling(
          "shield",
          "generation",
          shieldMethod,
          mockDepositAction.generateCalldata,
          mockDepositAction.sendCalldata,
          createMockDepositCalldata()
        );
      });

      it("should handle calldata sending errors", async () => {
        await testErrorHandling(
          "shield",
          "sending",
          shieldMethod,
          mockDepositAction.generateCalldata,
          mockDepositAction.sendCalldata,
          createMockDepositCalldata()
        );
      });

      it("should handle OutdatedSdkError during calldata generation", async () => {
        await testOutdatedSdkError(
          "shield",
          shieldMethod,
          mockDepositAction.generateCalldata
        );
      });

      it("should throw error when transaction fails", async () => {
        await testTransactionFailure(
          shieldMethod,
          mockDepositAction.generateCalldata,
          mockDepositAction.sendCalldata,
          createMockDepositCalldata()
        );
      });
    });
  });

  describe("withdraw", () => {
    const withdrawMethod = () =>
      actions.withdraw(mockToken, mockAmount, mockTotalFee, mockAddress);

    it("should throw error when account not found", async () => {
      mockAccountRegistry.getAccountState.mockResolvedValue(null);

      await expect(withdrawMethod()).rejects.toThrow("Account not found");

      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockRelayer.address).not.toHaveBeenCalled();
      expect(mockWithdrawAction.generateCalldata).not.toHaveBeenCalled();
    });

    it("should withdraw funds using relayer", async () => {
      const mockCalldata = createMockWithdrawCalldata();
      mockWithdrawAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockWithdrawAction.sendCalldataWithRelayer.mockResolvedValue(mockTxHash);

      const txHash = await withdrawMethod();

      expect(txHash).toBe(mockTxHash);
      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockRelayer.address).toHaveBeenCalled();
      expect(mockWithdrawAction.generateCalldata).toHaveBeenCalledWith(
        mockAccountState,
        mockAmount,
        mockRelayerAddress,
        mockTotalFee,
        mockAddress,
        contractVersion
      );
      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        "withdraw"
      );
      expect(mockWithdrawAction.sendCalldataWithRelayer).toHaveBeenCalledWith(
        mockCalldata
      );
      expect(mockCallbacks.onCalldataSent).toHaveBeenCalledWith(
        mockTxHash,
        "withdraw"
      );
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
        mockToken
      );
    });

    it("should handle calldata generation errors", async () => {
      await testErrorHandling(
        "withdraw",
        "generation",
        withdrawMethod,
        mockWithdrawAction.generateCalldata,
        mockWithdrawAction.sendCalldataWithRelayer,
        createMockWithdrawCalldata()
      );
    });

    it("should handle calldata sending errors", async () => {
      await testErrorHandling(
        "withdraw",
        "sending",
        withdrawMethod,
        mockWithdrawAction.generateCalldata,
        mockWithdrawAction.sendCalldataWithRelayer,
        createMockWithdrawCalldata()
      );
    });

    it("should handle OutdatedSdkError during calldata generation", async () => {
      await testOutdatedSdkError(
        "withdraw",
        withdrawMethod,
        mockWithdrawAction.generateCalldata
      );
    });
  });

  describe("withdrawManual", () => {
    const withdrawManualMethod = () =>
      actions.withdrawManual(
        mockToken,
        mockAmount,
        mockAddress,
        mockSendTransaction,
        mockFrom
      );

    it("should throw error when account not found", async () => {
      mockAccountRegistry.getAccountState.mockResolvedValue(null);

      await expect(withdrawManualMethod()).rejects.toThrow("Account not found");

      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockWithdrawAction.generateCalldata).not.toHaveBeenCalled();
    });

    it("should withdraw funds manually", async () => {
      const mockCalldata = createMockWithdrawCalldata(0n);
      mockWithdrawAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockWithdrawAction.sendCalldata.mockResolvedValue(mockTxHash);

      const txHash = await withdrawManualMethod();

      expect(txHash).toBe(mockTxHash);
      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockWithdrawAction.generateCalldata).toHaveBeenCalledWith(
        mockAccountState,
        mockAmount,
        mockFrom,
        0n, // totalFee is 0 for manual withdrawals
        mockAddress,
        contractVersion
      );
      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        "withdraw"
      );
      expect(mockWithdrawAction.sendCalldata).toHaveBeenCalledWith(
        mockCalldata,
        mockSendTransaction,
        mockFrom
      );
      expect(mockCallbacks.onCalldataSent).toHaveBeenCalledWith(
        mockTxHash,
        "withdraw"
      );
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
        mockToken
      );
    });

    it("should handle calldata generation errors", async () => {
      await testErrorHandling(
        "withdraw",
        "generation",
        withdrawManualMethod,
        mockWithdrawAction.generateCalldata,
        mockWithdrawAction.sendCalldata,
        createMockWithdrawCalldata(0n)
      );
    });

    it("should handle calldata sending errors", async () => {
      await testErrorHandling(
        "withdraw",
        "sending",
        withdrawManualMethod,
        mockWithdrawAction.generateCalldata,
        mockWithdrawAction.sendCalldata,
        createMockWithdrawCalldata(0n)
      );
    });

    it("should handle OutdatedSdkError during calldata generation", async () => {
      await testOutdatedSdkError(
        "withdraw",
        withdrawManualMethod,
        mockWithdrawAction.generateCalldata
      );
    });
  });
});
