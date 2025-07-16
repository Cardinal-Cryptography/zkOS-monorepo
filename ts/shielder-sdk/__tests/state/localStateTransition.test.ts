import { it, expect, describe, beforeEach, vi } from "vitest";
import { NoteEvent } from "../../src/chain/contract";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountStateMerkleIndexed } from "../../src/state/types";
import { nativeToken } from "../../src/utils";
import { NewAccountAction } from "../../src/actions/newAccount";
import { DepositAction } from "../../src/actions/deposit";
import { WithdrawAction } from "../../src/actions/withdraw";
import { LocalStateTransition } from "../../src/state/localStateTransition";
import { bytesToHex } from "viem";

// Utility function to create a note event
const createNoteEvent = (
  name: "NewAccount" | "Deposit" | "Withdraw",
  amount: bigint,
  newNoteIndex: bigint
): NoteEvent => ({
  name,
  amount,
  newNote: 123n, // Simplified for testing
  newNoteIndex,
  contractVersion: "0x000101",
  txHash: "0x123",
  block: 1n,
  tokenAddress: "0x0000000000000000000000000000000000000000",
  protocolFee: 0n,
  memo: bytesToHex(new Uint8Array)
});

// Utility function to create a mock state
const createMockState = (
  overrides: Partial<AccountStateMerkleIndexed> = {}
): AccountStateMerkleIndexed => ({
  id: Scalar.fromBigint(1n),
  currentNote: Scalar.fromBigint(100n),
  currentNoteIndex: 1n,
  nonce: 0n,
  balance: 100n,
  token: nativeToken(),
  ...overrides
});

describe("LocalStateTransition", () => {
  let localStateTransition: LocalStateTransition;
  let mockNewAccountAction: NewAccountAction;
  let mockDepositAction: DepositAction;
  let mockWithdrawAction: WithdrawAction;
  let initialState: AccountStateMerkleIndexed;

  // Mock action method results
  const mockActionResult = createMockState({
    nonce: 1n,
    balance: 150n,
    currentNote: Scalar.fromBigint(200n)
  });

  beforeEach(() => {
    // Create mocks for action classes
    mockNewAccountAction = {
      rawNewAccount: vi.fn().mockResolvedValue(mockActionResult)
    } as unknown as NewAccountAction;

    mockDepositAction = {
      rawDeposit: vi.fn().mockResolvedValue(mockActionResult)
    } as unknown as DepositAction;

    mockWithdrawAction = {
      rawWithdraw: vi.fn().mockResolvedValue(mockActionResult)
    } as unknown as WithdrawAction;

    localStateTransition = new LocalStateTransition(
      mockNewAccountAction,
      mockDepositAction,
      mockWithdrawAction
    );

    initialState = createMockState();
  });

  // Parametrized test for different event types
  it.each([
    {
      eventName: "NewAccount" as const,
      actionMethod: "rawNewAccount",
      actionMock: () => mockNewAccountAction.rawNewAccount
    },
    {
      eventName: "Deposit" as const,
      actionMethod: "rawDeposit",
      actionMock: () => mockDepositAction.rawDeposit
    },
    {
      eventName: "Withdraw" as const,
      actionMethod: "rawWithdraw",
      actionMock: () => mockWithdrawAction.rawWithdraw
    }
  ])(
    "should call $actionMethod for $eventName event",
    async ({ eventName, actionMock }) => {
      const amount = 50n;
      const newNoteIndex = 2n;
      const noteEvent = createNoteEvent(eventName, amount, newNoteIndex);

      const result = await localStateTransition.newStateByEvent(
        initialState,
        noteEvent
      );

      expect(actionMock()).toHaveBeenCalledWith(initialState, amount);

      expect(result).not.toBeNull();
      expect(result?.currentNoteIndex).toBe(newNoteIndex);
      expect(result?.nonce).toBe(mockActionResult.nonce);
      expect(result?.balance).toBe(mockActionResult.balance);
      expect(result?.currentNote).toBe(mockActionResult.currentNote);
    }
  );

  it("should return null if action returns null", async () => {
    mockWithdrawAction.rawWithdraw = vi.fn().mockResolvedValue(null);
    const noteEvent = createNoteEvent("Withdraw", 200n, 4n);

    const result = await localStateTransition.newStateByEvent(
      initialState,
      noteEvent
    );

    expect(result).toBeNull();
    expect(mockWithdrawAction.rawWithdraw).toHaveBeenCalledWith(
      initialState,
      200n
    );
  });
});
