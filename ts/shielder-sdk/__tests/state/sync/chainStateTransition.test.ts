import { it, expect, describe, beforeEach, vi } from "vitest";
import { IContract, NoteEvent } from "../../../src/chain/contract";
import { MockedCryptoClient } from "../../helpers";
import { AccountStateMerkleIndexed } from "../../../src/state/types";
import { nativeToken } from "../../../src/utils";
import {
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { OutdatedSdkError } from "../../../src/errors";
import { LocalStateTransition } from "../../../src/state/localStateTransition";
import { ChainStateTransition } from "../../../src/state/sync/chainStateTransition";
import { bytesToHex } from "viem";

describe("ChainStateTransition", () => {
  let chainStateTransition: ChainStateTransition;
  let mockContract: IContract;
  let mockCryptoClient: MockedCryptoClient;
  let mockLocalStateTransition: LocalStateTransition;
  let mockState: AccountStateMerkleIndexed;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockNullifierBlock: any;
  let mockGetNoteEventsFromBlock: any;
  let mockNewStateByEvent: any;

  const nativeTokenAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(() => {
    mockState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 1n,
      balance: 100n,
      currentNote: Scalar.fromBigint(100n),
      currentNoteIndex: 1n
    };

    mockCryptoClient = new MockedCryptoClient();

    mockNullifierBlock = vi.fn();
    mockGetNoteEventsFromBlock = vi.fn();
    mockContract = {
      nullifierBlock: mockNullifierBlock,
      getNoteEventsFromBlock: mockGetNoteEventsFromBlock
    } as any;

    mockNewStateByEvent = vi.fn();
    mockLocalStateTransition = {
      newStateByEvent: mockNewStateByEvent
    } as any;

    chainStateTransition = new ChainStateTransition(
      mockContract,
      mockCryptoClient,
      mockLocalStateTransition
    );
  });

  describe("findStateTransition", () => {
    it("should find state transition successfully", async () => {
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      const mockEvent: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0x000101", // Use the supported version from constants
        txHash: "0x123",
        block: 1n,
        tokenAddress: nativeTokenAddress,
        protocolFee: 0n,
        memo: bytesToHex(new Uint8Array()),
      };

      const mockNewState: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(789n),
        currentNoteIndex: 2n
      };

      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier
      });

      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      mockNullifierBlock.mockResolvedValue(1n);

      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent]);

      mockNewStateByEvent.mockResolvedValue(mockNewState);

      const result = await chainStateTransition.findStateTransition(mockState);

      expect(result).not.toBeNull();
      expect(result?.newState).toEqual(mockNewState);
      expect(result?.transaction).toEqual({
        type: "Deposit",
        amount: 50n,
        txHash: "0x123",
        block: 1n,
        token: nativeToken(),
        newNote: Scalar.fromBigint(789n),
        protocolFee: 0n,
        memo: bytesToHex(new Uint8Array()),
      });

      expect(mockNullifierBlock).toHaveBeenCalledWith(
        scalarToBigint(mockNullifierHash)
      );
      expect(mockGetNoteEventsFromBlock).toHaveBeenCalledWith(1n);

      expect(mockNewStateByEvent).toHaveBeenCalledWith(mockState, mockEvent);
    });

    it("should return null when no nullifier block is found", async () => {
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier
      });

      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      mockNullifierBlock.mockResolvedValue(null);

      const result = await chainStateTransition.findStateTransition(mockState);

      expect(result).toBeNull();

      expect(mockNullifierBlock).toHaveBeenCalledWith(
        scalarToBigint(mockNullifierHash)
      );

      expect(mockGetNoteEventsFromBlock).not.toHaveBeenCalled();
    });

    it("should use pre-nullifier for state with nonce 0", async () => {
      const stateWithZeroNonce: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 0n
      };

      const mockNullifierHash = Scalar.fromBigint(456n);

      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      mockNullifierBlock.mockResolvedValue(null);

      await chainStateTransition.findStateTransition(stateWithZeroNonce);

      expect(mockCryptoClient.hasher.poseidonHash).toHaveBeenCalledWith([
        stateWithZeroNonce.id
      ]);
    });

    it("should throw OutdatedSdkError for unsupported contract version", async () => {
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      const mockEvent: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0xFFFFFF", // Unsupported version
        txHash: "0x123",
        block: 1n,
        tokenAddress: nativeTokenAddress,
        protocolFee: 0n,
        memo: bytesToHex(new Uint8Array())
      };

      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier
      });

      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      mockNullifierBlock.mockResolvedValue(1n);

      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent]);

      await expect(
        chainStateTransition.findStateTransition(mockState)
      ).rejects.toThrow(OutdatedSdkError);
    });

    it("should throw error when no events are found for block", async () => {
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier
      });

      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      mockNullifierBlock.mockResolvedValue(1n);

      mockGetNoteEventsFromBlock.mockResolvedValue([]);

      await expect(
        chainStateTransition.findStateTransition(mockState)
      ).rejects.toThrow("Unexpected number of events: 0, expected 1 event");
    });

    it("should throw error when state-changing event token does not match state token", async () => {
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      const mockEvent: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0x000101", // Use the supported version from constants
        txHash: "0x123",
        block: 1n,
        tokenAddress: "0x123",
        protocolFee: 0n,
        memo: bytesToHex(new Uint8Array())
      };

      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier
      });

      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      mockNullifierBlock.mockResolvedValue(1n);

      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent]);

      await expect(
        chainStateTransition.findStateTransition(mockState)
      ).rejects.toThrow(
        `Unexpected token address in event: ${mockEvent.tokenAddress}`
      );
    });
  });
});
