import { it, expect, describe, beforeEach, vi } from "vitest";
import { StateTransitionFinder } from "../../../src/state/sync/stateTransitionFinder";
import { IContract, NoteEvent } from "../../../src/chain/contract";
import { StateEventsFilter } from "../../../src/state/events";
import { MockedCryptoClient } from "../../helpers";
import { AccountStateMerkleIndexed } from "../../../src/state/types";
import { nativeToken } from "../../../src/utils";
import {
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { OutdatedSdkError } from "../../../src/errors";

describe("StateTransitionFinder", () => {
  let stateTransitionFinder: StateTransitionFinder;
  let mockContract: IContract;
  let mockCryptoClient: MockedCryptoClient;
  let mockStateEventsFilter: StateEventsFilter;
  let mockState: AccountStateMerkleIndexed;
  // Explicitly type mock functions to avoid TypeScript errors
  let mockNullifierBlock: any;
  let mockGetNoteEventsFromBlock: any;
  let mockStateChangingEvents: any;
  let mockNewStateByEvent: any;

  beforeEach(() => {
    // Create mock state
    mockState = {
      id: Scalar.fromBigint(1n),
      token: nativeToken(),
      nonce: 1n,
      balance: 100n,
      currentNote: Scalar.fromBigint(100n),
      currentNoteIndex: 1n
    };

    // Create mock CryptoClient
    mockCryptoClient = new MockedCryptoClient();

    // Create mock Contract
    mockNullifierBlock = vi.fn();
    mockGetNoteEventsFromBlock = vi.fn();
    mockContract = {
      nullifierBlock: mockNullifierBlock,
      getNoteEventsFromBlock: mockGetNoteEventsFromBlock
    } as any;

    // Create mock StateEventsFilter
    mockStateChangingEvents = vi.fn();
    mockNewStateByEvent = vi.fn();
    mockStateEventsFilter = {
      stateChangingEvents: mockStateChangingEvents,
      newStateByEvent: mockNewStateByEvent
    } as any;

    // Create StateTransitionFinder instance
    stateTransitionFinder = new StateTransitionFinder(
      mockContract,
      mockCryptoClient,
      mockStateEventsFilter
    );
  });

  describe("findStateTransition", () => {
    it("should find state transition successfully", async () => {
      // Mock nullifier hash
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Mock event with supported contract version
      const mockEvent: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0x000100", // Use the supported version from constants
        txHash: "0x123",
        block: 1n
      };

      // Mock new state
      const mockNewState: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 2n,
        balance: 150n,
        currentNote: Scalar.fromBigint(789n),
        currentNoteIndex: 2n
      };

      // Setup mock behavior
      // Mock getting nullifier
      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier,
        trapdoor: Scalar.fromBigint(0n)
      });

      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock
      mockNullifierBlock.mockResolvedValue(1n);

      // Mock getNoteEventsFromBlock
      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent]);

      // Mock stateChangingEvents
      mockStateChangingEvents.mockResolvedValue([mockEvent]);

      // Mock newStateByEvent
      mockNewStateByEvent.mockResolvedValue(mockNewState);

      // Call the method
      const result = await stateTransitionFinder.findStateTransition(mockState);

      // Verify results
      expect(result).not.toBeNull();
      expect(result?.newState).toEqual(mockNewState);
      expect(result?.transaction).toEqual({
        type: "Deposit",
        amount: 50n,
        txHash: "0x123",
        block: 1n,
        token: nativeToken()
      });

      // Verify contract was called correctly
      expect(mockNullifierBlock).toHaveBeenCalledWith(
        scalarToBigint(mockNullifierHash)
      );
      expect(mockGetNoteEventsFromBlock).toHaveBeenCalledWith(1n);

      // Verify StateEventsFilter was called correctly
      expect(mockStateChangingEvents).toHaveBeenCalledWith(mockState, [
        mockEvent
      ]);
      expect(mockNewStateByEvent).toHaveBeenCalledWith(mockState, mockEvent);
    });

    it("should return null when no nullifier block is found", async () => {
      // Mock nullifier hash
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Setup mock behavior
      // Mock getting nullifier
      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier,
        trapdoor: Scalar.fromBigint(0n)
      });

      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock to return null (no block found)
      mockNullifierBlock.mockResolvedValue(null);

      // Call the method
      const result = await stateTransitionFinder.findStateTransition(mockState);

      // Verify results
      expect(result).toBeNull();

      // Verify contract was called correctly
      expect(mockNullifierBlock).toHaveBeenCalledWith(
        scalarToBigint(mockNullifierHash)
      );

      // Verify getNoteEventsFromBlock was not called
      expect(mockGetNoteEventsFromBlock).not.toHaveBeenCalled();
    });

    it("should use pre-nullifier for state with nonce 0", async () => {
      // Create state with nonce 0
      const stateWithZeroNonce: AccountStateMerkleIndexed = {
        ...mockState,
        nonce: 0n
      };

      // Mock nullifier hash
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Setup mock behavior
      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock
      mockNullifierBlock.mockResolvedValue(null);

      // Call the method
      await stateTransitionFinder.findStateTransition(stateWithZeroNonce);

      // Verify poseidonHash was called with the state ID (pre-nullifier)
      expect(mockCryptoClient.hasher.poseidonHash).toHaveBeenCalledWith([
        stateWithZeroNonce.id
      ]);
    });

    it("should throw OutdatedSdkError for unsupported contract version", async () => {
      // Mock nullifier hash
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Mock event with unsupported version
      const mockEvent: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0xFFFFFF", // Unsupported version
        txHash: "0x123",
        block: 1n
      };

      // Setup mock behavior
      // Mock getting nullifier
      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier,
        trapdoor: Scalar.fromBigint(0n)
      });

      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock
      mockNullifierBlock.mockResolvedValue(1n);

      // Mock getNoteEventsFromBlock
      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent]);

      // Mock stateChangingEvents
      mockStateChangingEvents.mockResolvedValue([mockEvent]);

      // Call the method and expect it to throw
      await expect(
        stateTransitionFinder.findStateTransition(mockState)
      ).rejects.toThrow(OutdatedSdkError);
    });

    it("should throw error when no events are found for block", async () => {
      // Mock nullifier hash
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Setup mock behavior
      // Mock getting nullifier
      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier,
        trapdoor: Scalar.fromBigint(0n)
      });

      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock
      mockNullifierBlock.mockResolvedValue(1n);

      // Mock getNoteEventsFromBlock
      mockGetNoteEventsFromBlock.mockResolvedValue([]);

      // Mock stateChangingEvents to return empty array
      mockStateChangingEvents.mockResolvedValue([]);

      // Call the method and expect it to throw
      await expect(
        stateTransitionFinder.findStateTransition(mockState)
      ).rejects.toThrow("Unexpected number of events: 0, expected 1 event");
    });

    it("should throw error when multiple events are found for block", async () => {
      // Mock nullifier hash
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Mock events
      const mockEvent1: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0x000100", // Use the supported version from constants
        txHash: "0x123",
        block: 1n
      };

      const mockEvent2: NoteEvent = {
        name: "Deposit",
        amount: 25n,
        newNote: 456n,
        newNoteIndex: 3n,
        contractVersion: "0x000100", // Use the supported version from constants
        txHash: "0x456",
        block: 1n
      };

      // Setup mock behavior
      // Mock getting nullifier
      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier,
        trapdoor: Scalar.fromBigint(0n)
      });

      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock
      mockNullifierBlock.mockResolvedValue(1n);

      // Mock getNoteEventsFromBlock
      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent1, mockEvent2]);

      // Mock stateChangingEvents to return multiple events
      mockStateChangingEvents.mockResolvedValue([mockEvent1, mockEvent2]);

      // Call the method and expect it to throw
      await expect(
        stateTransitionFinder.findStateTransition(mockState)
      ).rejects.toThrow("Unexpected number of events: 2, expected 1 event");
    });

    it("should throw error when newStateByEvent returns null", async () => {
      // Mock nullifier hash
      const mockNullifier = Scalar.fromBigint(123n);
      const mockNullifierHash = Scalar.fromBigint(456n);

      // Mock event
      const mockEvent: NoteEvent = {
        name: "Deposit",
        amount: 50n,
        newNote: 789n,
        newNoteIndex: 2n,
        contractVersion: "0x000100", // Use the supported version from constants
        txHash: "0x123",
        block: 1n
      };

      // Setup mock behavior
      // Mock getting nullifier
      vi.spyOn(mockCryptoClient.secretManager, "getSecrets").mockResolvedValue({
        nullifier: mockNullifier,
        trapdoor: Scalar.fromBigint(0n)
      });

      // Mock hashing nullifier
      vi.spyOn(mockCryptoClient.hasher, "poseidonHash").mockResolvedValue(
        mockNullifierHash
      );

      // Mock contract nullifierBlock
      mockNullifierBlock.mockResolvedValue(1n);

      // Mock getNoteEventsFromBlock
      mockGetNoteEventsFromBlock.mockResolvedValue([mockEvent]);

      // Mock stateChangingEvents
      mockStateChangingEvents.mockResolvedValue([mockEvent]);

      // Mock newStateByEvent to return null (which should not happen in normal operation)
      mockNewStateByEvent.mockResolvedValue(null);

      // Call the method and expect it to throw
      await expect(
        stateTransitionFinder.findStateTransition(mockState)
      ).rejects.toThrow("State is null, this should not happen");
    });
  });

  // We don't need to test the eventToTransaction function separately as it's tested indirectly
  // through the findStateTransition test
});
