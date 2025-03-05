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

    it("should propagate errors from relayer", async () => {
      const mockError = new Error("Failed to quote fees");
      mockRelayer.quoteFees.mockRejectedValue(mockError);

      await expect(actions.getWithdrawFees()).rejects.toThrow(mockError);
    });
  });

  describe("shield", () => {
    it("should throw error when account not found and createEmptyAccountState fails", async () => {
      // Setup mock for new account
      mockAccountRegistry.getAccountState.mockResolvedValue(null);
      const mockError = new Error("Failed to create empty account state");
      mockAccountRegistry.createEmptyAccountState.mockRejectedValue(mockError);

      await expect(
        actions.shield(mockToken, mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(mockError);

      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockAccountRegistry.createEmptyAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockNewAccountAction.generateCalldata).not.toHaveBeenCalled();
    });

    it("should create a new account when nonce is 0", async () => {
      // Setup mock for new account
      mockAccountState.nonce = 0n;
      mockAccountRegistry.getAccountState.mockResolvedValue(null);
      mockAccountRegistry.createEmptyAccountState.mockResolvedValue(
        mockAccountState
      );

      const mockCalldata: NewAccountCalldata = {
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
      };
      mockNewAccountAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockNewAccountAction.sendCalldata.mockResolvedValue(mockTxHash);

      const txHash = await actions.shield(
        mockToken,
        mockAmount,
        mockSendTransaction,
        mockFrom
      );

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
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
        mockToken
      );
    });

    it("should deposit to existing account when nonce is not 0", async () => {
      // Setup mock for deposit
      mockAccountState.nonce = 1n;
      mockAccountRegistry.getAccountState.mockResolvedValue(mockAccountState);

      const mockCalldata: DepositCalldata = {
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
      };
      mockDepositAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockDepositAction.sendCalldata.mockResolvedValue(mockTxHash);

      const txHash = await actions.shield(
        mockToken,
        mockAmount,
        mockSendTransaction,
        mockFrom
      );

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
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
        mockToken
      );
    });

    it("should handle calldata generation errors", async () => {
      const mockError = new Error("Failed to generate calldata");
      mockNewAccountAction.generateCalldata.mockRejectedValue(mockError);
      mockAccountState.nonce = 0n;
      mockAccountRegistry.getAccountState.mockResolvedValue(null);
      mockAccountRegistry.createEmptyAccountState.mockResolvedValue(
        mockAccountState
      );

      await expect(
        actions.shield(mockToken, mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        "shield"
      );
      expect(mockCallbacks.onCalldataGenerated).not.toHaveBeenCalled();
      expect(mockNewAccountAction.sendCalldata).not.toHaveBeenCalled();
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should handle calldata sending errors", async () => {
      const mockError = new Error("Failed to send calldata");
      const mockCalldata: NewAccountCalldata = {
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
      };
      mockNewAccountAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockNewAccountAction.sendCalldata.mockRejectedValue(mockError);
      mockAccountState.nonce = 0n;
      mockAccountRegistry.getAccountState.mockResolvedValue(null);
      mockAccountRegistry.createEmptyAccountState.mockResolvedValue(
        mockAccountState
      );

      await expect(
        actions.shield(mockToken, mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        "shield"
      );
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "sending",
        "shield"
      );
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should throw error when transaction fails", async () => {
      mockAccountState.nonce = 0n;
      mockAccountRegistry.getAccountState.mockResolvedValue(mockAccountState);
      const mockCalldata: NewAccountCalldata = {
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
      };
      mockNewAccountAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockNewAccountAction.sendCalldata.mockResolvedValue(mockTxHash);
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
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

      await expect(
        actions.shield(mockToken, mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow("Transaction failed");

      expect(mockStateSynchronizer.syncSingleAccount).not.toHaveBeenCalled();
    });

    it("should handle OutdatedSdkError during calldata generation", async () => {
      const mockError = new OutdatedSdkError("Outdated SDK version");
      mockNewAccountAction.generateCalldata.mockRejectedValue(mockError);
      mockAccountState.nonce = 0n;
      mockAccountRegistry.getAccountState.mockResolvedValue(null);
      mockAccountRegistry.createEmptyAccountState.mockResolvedValue(
        mockAccountState
      );

      await expect(
        actions.shield(mockToken, mockAmount, mockSendTransaction, mockFrom)
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        "shield"
      );
    });
  });

  describe("withdraw", () => {
    it("should throw error when account not found", async () => {
      // Setup mock for account not found
      mockAccountRegistry.getAccountState.mockResolvedValue(null);

      await expect(
        actions.withdraw(mockToken, mockAmount, mockTotalFee, mockAddress)
      ).rejects.toThrow("Account not found");

      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockRelayer.address).not.toHaveBeenCalled();
      expect(mockWithdrawAction.generateCalldata).not.toHaveBeenCalled();
    });

    it("should throw error when withdrawManual is called with account not found", async () => {
      // Setup mock for account not found
      mockAccountRegistry.getAccountState.mockResolvedValue(null);

      await expect(
        actions.withdrawManual(
          mockToken,
          mockAmount,
          mockAddress,
          mockSendTransaction,
          mockFrom
        )
      ).rejects.toThrow("Account not found");

      expect(mockAccountRegistry.getAccountState).toHaveBeenCalledWith(
        mockToken
      );
      expect(mockWithdrawAction.generateCalldata).not.toHaveBeenCalled();
    });

    it("should withdraw funds using relayer", async () => {
      const mockCalldata: WithdrawCalldata = {
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
        totalFee: mockTotalFee,
        token: mockToken
      };
      mockWithdrawAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockWithdrawAction.sendCalldataWithRelayer.mockResolvedValue(mockTxHash);

      const txHash = await actions.withdraw(
        mockToken,
        mockAmount,
        mockTotalFee,
        mockAddress
      );

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
      const mockError = new Error("Failed to generate calldata");
      mockWithdrawAction.generateCalldata.mockRejectedValue(mockError);

      await expect(
        actions.withdraw(mockToken, mockAmount, mockTotalFee, mockAddress)
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        "withdraw"
      );
      expect(mockCallbacks.onCalldataGenerated).not.toHaveBeenCalled();
      expect(mockWithdrawAction.sendCalldataWithRelayer).not.toHaveBeenCalled();
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should handle calldata sending errors", async () => {
      const mockError = new Error("Failed to send calldata");
      const mockCalldata: WithdrawCalldata = {
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
        totalFee: mockTotalFee,
        token: mockToken
      };
      mockWithdrawAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockWithdrawAction.sendCalldataWithRelayer.mockRejectedValue(mockError);

      await expect(
        actions.withdraw(mockToken, mockAmount, mockTotalFee, mockAddress)
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        "withdraw"
      );
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "sending",
        "withdraw"
      );
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should handle OutdatedSdkError during calldata generation", async () => {
      const mockError = new OutdatedSdkError("Outdated SDK version");
      mockWithdrawAction.generateCalldata.mockRejectedValue(mockError);

      await expect(
        actions.withdraw(mockToken, mockAmount, mockTotalFee, mockAddress)
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        "withdraw"
      );
    });
  });

  describe("withdrawManual", () => {
    it("should withdraw funds manually", async () => {
      const mockCalldata: WithdrawCalldata = {
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
        totalFee: 0n,
        token: mockToken
      };
      mockWithdrawAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockWithdrawAction.sendCalldata.mockResolvedValue(mockTxHash);

      const txHash = await actions.withdrawManual(
        mockToken,
        mockAmount,
        mockAddress,
        mockSendTransaction,
        mockFrom
      );

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
      const mockError = new Error("Failed to generate calldata");
      mockWithdrawAction.generateCalldata.mockRejectedValue(mockError);

      await expect(
        actions.withdrawManual(
          mockToken,
          mockAmount,
          mockAddress,
          mockSendTransaction,
          mockFrom
        )
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        "withdraw"
      );
      expect(mockCallbacks.onCalldataGenerated).not.toHaveBeenCalled();
      expect(mockWithdrawAction.sendCalldata).not.toHaveBeenCalled();
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should handle calldata sending errors", async () => {
      const mockError = new Error("Failed to send calldata");
      const mockCalldata: WithdrawCalldata = {
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
        totalFee: 0n,
        token: mockToken
      };
      mockWithdrawAction.generateCalldata.mockResolvedValue(mockCalldata);
      mockWithdrawAction.sendCalldata.mockRejectedValue(mockError);

      await expect(
        actions.withdrawManual(
          mockToken,
          mockAmount,
          mockAddress,
          mockSendTransaction,
          mockFrom
        )
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        "withdraw"
      );
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "sending",
        "withdraw"
      );
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should handle OutdatedSdkError during calldata generation", async () => {
      const mockError = new OutdatedSdkError("Outdated SDK version");
      mockWithdrawAction.generateCalldata.mockRejectedValue(mockError);

      await expect(
        actions.withdrawManual(
          mockToken,
          mockAmount,
          mockAddress,
          mockSendTransaction,
          mockFrom
        )
      ).rejects.toThrow(mockError);

      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        "withdraw"
      );
    });
  });

  describe("waitAndSync", () => {
    it("should wait for transaction receipt and sync account", async () => {
      // We need to access the private method using any
      const waitAndSync = (actions as any).waitAndSync.bind(actions);

      await waitAndSync(mockToken, mockTxHash);

      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
        hash: mockTxHash
      });
      expect(mockStateSynchronizer.syncSingleAccount).toHaveBeenCalledWith(
        mockToken
      );
    });

    it("should throw error when transaction fails", async () => {
      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
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

      // We need to access the private method using any
      const waitAndSync = (actions as any).waitAndSync.bind(actions);

      await expect(waitAndSync(mockToken, mockTxHash)).rejects.toThrow(
        "Transaction failed"
      );

      expect(mockStateSynchronizer.syncSingleAccount).not.toHaveBeenCalled();
    });
  });

  describe("handleCalldata", () => {
    it("should handle calldata generation and sending", async () => {
      const mockCalldata: NewAccountCalldata = {
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
      };
      const generateCalldata = vitest.fn().mockResolvedValue(mockCalldata);
      const sendCalldata = vitest.fn().mockResolvedValue(mockTxHash);
      const operation: ShielderOperation = "shield";

      // We need to access the private method using any
      const handleCalldata = (actions as any).handleCalldata.bind(actions);

      const result = await handleCalldata(
        generateCalldata,
        sendCalldata,
        operation
      );

      expect(result).toBe(mockTxHash);
      expect(generateCalldata).toHaveBeenCalled();
      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        operation
      );
      expect(sendCalldata).toHaveBeenCalledWith(mockCalldata);
      expect(mockCallbacks.onCalldataSent).toHaveBeenCalledWith(
        mockTxHash,
        operation
      );
    });

    it("should handle calldata generation errors", async () => {
      const mockError = new Error("Failed to generate calldata");
      const generateCalldata = vitest.fn().mockRejectedValue(mockError);
      const sendCalldata = vitest.fn();
      const operation: ShielderOperation = "shield";

      // We need to access the private method using any
      const handleCalldata = (actions as any).handleCalldata.bind(actions);

      await expect(
        handleCalldata(generateCalldata, sendCalldata, operation)
      ).rejects.toThrow(mockError);

      expect(generateCalldata).toHaveBeenCalled();
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "generation",
        operation
      );
      expect(mockCallbacks.onCalldataGenerated).not.toHaveBeenCalled();
      expect(sendCalldata).not.toHaveBeenCalled();
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });

    it("should handle calldata sending errors", async () => {
      const mockCalldata: NewAccountCalldata = {
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
      };
      const mockError = new Error("Failed to send calldata");
      const generateCalldata = vitest.fn().mockResolvedValue(mockCalldata);
      const sendCalldata = vitest.fn().mockRejectedValue(mockError);
      const operation: ShielderOperation = "shield";

      // We need to access the private method using any
      const handleCalldata = (actions as any).handleCalldata.bind(actions);

      await expect(
        handleCalldata(generateCalldata, sendCalldata, operation)
      ).rejects.toThrow(mockError);

      expect(generateCalldata).toHaveBeenCalled();
      expect(mockCallbacks.onCalldataGenerated).toHaveBeenCalledWith(
        mockCalldata,
        operation
      );
      expect(sendCalldata).toHaveBeenCalledWith(mockCalldata);
      expect(mockCallbacks.onError).toHaveBeenCalledWith(
        mockError,
        "sending",
        operation
      );
      expect(mockCallbacks.onCalldataSent).not.toHaveBeenCalled();
    });
  });
});
