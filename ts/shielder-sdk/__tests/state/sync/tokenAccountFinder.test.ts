import { it, expect, describe, beforeEach, vi } from "vitest";
import { TokenAccountFinder } from "../../../src/state/sync/tokenAccountFinder";
import { IContract } from "../../../src/chain/contract";
import {
  CryptoClient,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { IdManager } from "../../../src/state/idManager";
import { Token } from "../../../src/types";
import * as utils from "../../../src/utils";
import { erc20Token } from "../../../src/utils";

describe("TokenAccountFinder", () => {
  let tokenAccountFinder: TokenAccountFinder;
  let mockContract: IContract;
  let mockCryptoClient: CryptoClient;
  let mockIdManager: IdManager;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockNullifierBlock: any;
  let mockGetNewAccountEventsFromBlock: any;
  let mockGetId: any;
  let mockPoseidonHash: any;
  let mockGetTokenByAddress: any;

  beforeEach(() => {
    // Create mock Contract
    mockNullifierBlock = vi.fn();
    mockGetNewAccountEventsFromBlock = vi.fn();
    mockContract = {
      nullifierBlock: mockNullifierBlock,
      getNewAccountEventsFromBlock: mockGetNewAccountEventsFromBlock
    } as any;

    // Create mock CryptoClient
    mockPoseidonHash = vi.fn();
    mockCryptoClient = {
      hasher: {
        poseidonHash: mockPoseidonHash
      }
    } as any;

    // Create mock IdManager
    mockGetId = vi.fn();
    mockIdManager = {
      getId: mockGetId
    } as any;

    // Mock getTokenByAddress utility function
    mockGetTokenByAddress = vi.fn();
    vi.spyOn(utils, "getTokenByAddress").mockImplementation(
      mockGetTokenByAddress
    );

    // Create TokenAccountFinder instance
    tokenAccountFinder = new TokenAccountFinder(
      mockContract,
      mockCryptoClient,
      mockIdManager
    );
  });

  describe("findTokenByAccountIndex", () => {
    it("should find token successfully when account exists", async () => {
      // Mock data
      const accountIndex = 1;
      const preNullifier = Scalar.fromBigint(123n);
      const preNullifierHash = Scalar.fromBigint(456n);
      const block = 789n;
      const tokenAddress =
        "0x1234567890123456789012345678901234567890" as `0x${string}`;
      const mockToken: Token = erc20Token(tokenAddress);

      // Mock event
      const mockEvent = {
        idHash: 456n, // Same as preNullifierHash as bigint
        tokenAddress
      };

      // Setup mock behavior
      mockGetId.mockResolvedValue(preNullifier);
      mockPoseidonHash.mockResolvedValue(preNullifierHash);
      mockNullifierBlock.mockResolvedValue(block);
      mockGetNewAccountEventsFromBlock.mockResolvedValue([mockEvent]);
      mockGetTokenByAddress.mockReturnValue(mockToken);

      // Call the method
      const result =
        await tokenAccountFinder.findTokenByAccountIndex(accountIndex);

      // Verify results
      expect(result).toEqual(mockToken);

      // Verify dependencies were called correctly
      expect(mockGetId).toHaveBeenCalledWith(accountIndex);
      expect(mockPoseidonHash).toHaveBeenCalledWith([preNullifier]);
      expect(mockNullifierBlock).toHaveBeenCalledWith(456n); // preNullifierHash as bigint
      expect(mockGetNewAccountEventsFromBlock).toHaveBeenCalledWith(block);
      expect(mockGetTokenByAddress).toHaveBeenCalledWith(tokenAddress);
    });

    it("should return null when account does not exist", async () => {
      // Mock data
      const accountIndex = 1;
      const preNullifier = Scalar.fromBigint(123n);
      const preNullifierHash = Scalar.fromBigint(456n);

      // Setup mock behavior
      mockGetId.mockResolvedValue(preNullifier);
      mockPoseidonHash.mockResolvedValue(preNullifierHash);
      mockNullifierBlock.mockResolvedValue(null); // No block found

      // Call the method
      const result =
        await tokenAccountFinder.findTokenByAccountIndex(accountIndex);

      // Verify results
      expect(result).toBeNull();

      // Verify dependencies were called correctly
      expect(mockGetId).toHaveBeenCalledWith(accountIndex);
      expect(mockPoseidonHash).toHaveBeenCalledWith([preNullifier]);
      expect(mockNullifierBlock).toHaveBeenCalledWith(456n); // preNullifierHash as bigint
      expect(mockGetNewAccountEventsFromBlock).not.toHaveBeenCalled();
      expect(mockGetTokenByAddress).not.toHaveBeenCalled();
    });

    it("should throw error when no events are found", async () => {
      // Mock data
      const accountIndex = 1;
      const preNullifier = Scalar.fromBigint(123n);
      const preNullifierHash = Scalar.fromBigint(456n);
      const block = 789n;

      // Setup mock behavior
      mockGetId.mockResolvedValue(preNullifier);
      mockPoseidonHash.mockResolvedValue(preNullifierHash);
      mockNullifierBlock.mockResolvedValue(block);
      mockGetNewAccountEventsFromBlock.mockResolvedValue([]); // Empty events array

      // Call the method and expect it to throw
      await expect(
        tokenAccountFinder.findTokenByAccountIndex(accountIndex)
      ).rejects.toThrow("Unexpected number of events: 0, expected 1 event");

      // Verify dependencies were called correctly
      expect(mockGetId).toHaveBeenCalledWith(accountIndex);
      expect(mockPoseidonHash).toHaveBeenCalledWith([preNullifier]);
      expect(mockNullifierBlock).toHaveBeenCalledWith(456n); // preNullifierHash as bigint
      expect(mockGetNewAccountEventsFromBlock).toHaveBeenCalledWith(block);
    });

    it("should throw error when multiple events are found", async () => {
      // Mock data
      const accountIndex = 1;
      const preNullifier = Scalar.fromBigint(123n);
      const preNullifierHash = Scalar.fromBigint(456n);
      const block = 789n;
      const tokenAddress1 =
        "0x1111111111111111111111111111111111111111" as `0x${string}`;
      const tokenAddress2 =
        "0x2222222222222222222222222222222222222222" as `0x${string}`;

      // Mock events with the same idHash
      const mockEvents = [
        {
          idHash: 456n, // Same as preNullifierHash as bigint
          tokenAddress: tokenAddress1
        },
        {
          idHash: 456n, // Same as preNullifierHash as bigint
          tokenAddress: tokenAddress2
        }
      ];

      // Setup mock behavior
      mockGetId.mockResolvedValue(preNullifier);
      mockPoseidonHash.mockResolvedValue(preNullifierHash);
      mockNullifierBlock.mockResolvedValue(block);
      mockGetNewAccountEventsFromBlock.mockResolvedValue(mockEvents);

      // Call the method and expect it to throw
      await expect(
        tokenAccountFinder.findTokenByAccountIndex(accountIndex)
      ).rejects.toThrow("Unexpected number of events: 2, expected 1 event");

      // Verify dependencies were called correctly
      expect(mockGetId).toHaveBeenCalledWith(accountIndex);
      expect(mockPoseidonHash).toHaveBeenCalledWith([preNullifier]);
      expect(mockNullifierBlock).toHaveBeenCalledWith(456n); // preNullifierHash as bigint
      expect(mockGetNewAccountEventsFromBlock).toHaveBeenCalledWith(block);
    });

    it("should filter events by idHash", async () => {
      // Mock data
      const accountIndex = 1;
      const preNullifier = Scalar.fromBigint(123n);
      const preNullifierHash = Scalar.fromBigint(456n);
      const block = 789n;
      const tokenAddress1 =
        "0x1111111111111111111111111111111111111111" as `0x${string}`;
      const tokenAddress2 =
        "0x2222222222222222222222222222222222222222" as `0x${string}`;
      const mockToken: Token = erc20Token(tokenAddress1);

      // Mock events with different idHashes
      const mockEvents = [
        {
          idHash: 456n, // Matches preNullifierHash
          tokenAddress: tokenAddress1
        },
        {
          idHash: 789n, // Different idHash
          tokenAddress: tokenAddress2
        }
      ];

      // Setup mock behavior
      mockGetId.mockResolvedValue(preNullifier);
      mockPoseidonHash.mockResolvedValue(preNullifierHash);
      mockNullifierBlock.mockResolvedValue(block);
      mockGetNewAccountEventsFromBlock.mockResolvedValue(mockEvents);
      mockGetTokenByAddress.mockReturnValue(mockToken);

      // Call the method
      const result =
        await tokenAccountFinder.findTokenByAccountIndex(accountIndex);

      // Verify results
      expect(result).toEqual(mockToken);

      // Verify dependencies were called correctly
      expect(mockGetId).toHaveBeenCalledWith(accountIndex);
      expect(mockPoseidonHash).toHaveBeenCalledWith([preNullifier]);
      expect(mockNullifierBlock).toHaveBeenCalledWith(456n); // preNullifierHash as bigint
      expect(mockGetNewAccountEventsFromBlock).toHaveBeenCalledWith(block);
      expect(mockGetTokenByAddress).toHaveBeenCalledWith(tokenAddress1);
    });

    it("should propagate errors from dependencies", async () => {
      // Mock data
      const accountIndex = 1;
      const preNullifier = Scalar.fromBigint(123n);
      const testError = new Error("Test error");

      // Setup mock behavior to throw an error
      mockGetId.mockResolvedValue(preNullifier);
      mockPoseidonHash.mockRejectedValue(testError);

      // Call the method and expect it to throw
      await expect(
        tokenAccountFinder.findTokenByAccountIndex(accountIndex)
      ).rejects.toThrow(testError);

      // Verify dependencies were called correctly
      expect(mockGetId).toHaveBeenCalledWith(accountIndex);
      expect(mockPoseidonHash).toHaveBeenCalledWith([preNullifier]);
    });
  });
});
