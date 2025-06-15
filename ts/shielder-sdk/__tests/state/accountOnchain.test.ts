import { it, expect, describe, beforeEach, vi } from "vitest";
import { AccountOnchain } from "../../src/state/accountOnchain";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { IContract } from "../../src/chain/contract";
import { AccountNotOnChainError } from "../../src/errors";
import {
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { nativeToken } from "../../src/utils";
import { ContractFunctionRevertedError, encodeErrorResult } from "viem";

describe("AccountOnchain", () => {
  let accountOnchain: AccountOnchain;
  let mockContract: IContract;
  let testAccountState: AccountStateMerkleIndexed;

  beforeEach(() => {
    // Create a mock contract
    mockContract = {
      getMerklePath: vi.fn()
    } as any;

    // Create test account state
    testAccountState = {
      id: Scalar.fromBigint(123n),
      token: nativeToken(),
      nonce: 1n,
      balance: 1000n,
      currentNote: Scalar.fromBigint(456n),
      currentNoteIndex: 10n
    };

    accountOnchain = new AccountOnchain(mockContract);
  });

  describe("constructor", () => {
    it("should create an instance with the provided contract", () => {
      expect(accountOnchain).toBeInstanceOf(AccountOnchain);
    });
  });

  describe("validateAccountState", () => {
    it("should validate successfully when merkle path matches current note", async () => {
      // Setup: Mock getMerklePath to return a path where first element matches currentNote
      const expectedMerklePath = [
        scalarToBigint(testAccountState.currentNote), // First element matches
        789n,
        101112n
      ] as const;

      vi.mocked(mockContract.getMerklePath).mockResolvedValue(
        expectedMerklePath
      );

      // Act & Assert: Should not throw
      await expect(
        accountOnchain.validateAccountState(testAccountState)
      ).resolves.toBeUndefined();

      // Verify contract was called with correct index
      expect(mockContract.getMerklePath).toHaveBeenCalledWith(
        testAccountState.currentNoteIndex
      );
      expect(mockContract.getMerklePath).toHaveBeenCalledTimes(1);
    });

    it("should throw AccountNotOnChainError when merkle path does not match current note", async () => {
      // Setup: Mock getMerklePath to return a path where first element does NOT match
      const mismatchedMerklePath = [
        999n, // Different from currentNote (456n)
        789n,
        101112n
      ] as const;

      vi.mocked(mockContract.getMerklePath).mockResolvedValue(
        mismatchedMerklePath
      );

      // Act & Assert: Should throw AccountNotOnChainError
      await expect(
        accountOnchain.validateAccountState(testAccountState)
      ).rejects.toThrow(AccountNotOnChainError);

      await expect(
        accountOnchain.validateAccountState(testAccountState)
      ).rejects.toThrow(
        `Account state with merkle index ${testAccountState.currentNoteIndex} does not match on-chain data.`
      );

      // Verify contract was called with correct index
      expect(mockContract.getMerklePath).toHaveBeenCalledWith(
        testAccountState.currentNoteIndex
      );
    });

    it("should throw AccountNotOnChainError when contract getMerklePath fails", async () => {
      // Setup: Mock getMerklePath to throw an error
      // const contractError = new Error("Contract connection failed");
      const contractError = new ContractFunctionRevertedError({
        abi: [
          {
            type: "error",
            name: "LeafNotExisting",
            inputs: []
          }
        ],
        functionName: "getMerklePath",
        data: encodeErrorResult({
          abi: [
            {
              type: "error",
              name: "LeafNotExisting",
              inputs: []
            }
          ],
          errorName: "LeafNotExisting"
        })
      });
      vi.mocked(mockContract.getMerklePath).mockRejectedValue(contractError);

      // Act & Assert: Should throw AccountNotOnChainError with specific message
      await expect(
        accountOnchain.validateAccountState(testAccountState)
      ).rejects.toThrow(AccountNotOnChainError);

      await expect(
        accountOnchain.validateAccountState(testAccountState)
      ).rejects.toThrow(
        `Account state with index ${testAccountState.currentNoteIndex} does not exist on-chain.`
      );

      expect(mockContract.getMerklePath).toHaveBeenCalledWith(
        testAccountState.currentNoteIndex
      );
    });
  });
});
