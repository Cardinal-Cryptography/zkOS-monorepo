import { it, expect, describe, beforeEach } from "vitest";
import { MockedCryptoClient } from "../helpers";
import { AccountState, StateEventsFilter } from "../../src/state";
import {
  NewAccountAction,
  DepositAction,
  WithdrawAction,
  INonceGenerator
} from "../../src/actions/";
import { IContract, NoteEvent } from "../../src/chain/contract";
import { IRelayer } from "../../src/chain/relayer";
import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";

const expectStatesEqual = (state1: AccountState, state2: AccountState) => {
  expect(scalarsEqual(state1.id, state2.id)).toBe(true);
  expect(state1.nonce).toBe(state2.nonce);
  expect(state1.balance).toBe(state2.balance);
  expect(scalarsEqual(state1.currentNote, state2.currentNote)).toBe(true);
  expect(state1.storageSchemaVersion).toBe(state2.storageSchemaVersion);
};

describe("StateEventsFilter", () => {
  let stateEventsFilter: StateEventsFilter;
  let contract: IContract;
  let relayer: IRelayer;
  let cryptoClient: MockedCryptoClient;
  let newAccountAction: NewAccountAction;
  let depositAction: DepositAction;
  let withdrawAction: WithdrawAction;
  let nonceGenerator: INonceGenerator;

  let initialState: AccountState;

  beforeEach(() => {
    cryptoClient = new MockedCryptoClient();
    contract = {} as unknown as IContract;
    relayer = {} as unknown as IRelayer;
    nonceGenerator = {} as unknown as INonceGenerator;

    newAccountAction = new NewAccountAction(contract, cryptoClient);
    depositAction = new DepositAction(contract, cryptoClient, nonceGenerator);
    withdrawAction = new WithdrawAction(
      contract,
      relayer,
      cryptoClient,
      nonceGenerator
    );

    stateEventsFilter = new StateEventsFilter(
      newAccountAction,
      depositAction,
      withdrawAction
    );

    initialState = {
      id: Scalar.fromBigint(1n),
      currentNote: Scalar.fromBigint(100n),
      currentNoteIndex: 1n,
      nonce: 0n,
      balance: 100n,
      storageSchemaVersion: 1
    };
  });

  describe("newStateByEvent", () => {
    it("should handle NewAccountNative event", async () => {
      const noteEvent: NoteEvent = {
        name: "NewAccountNative",
        amount: 50n,
        newNote: scalarToBigint(
          await cryptoClient.hasher.poseidonHash([Scalar.fromBigint(50n)])
        ),
        newNoteIndex: 2n,
        contractVersion: "0x000001",
        txHash: "0x123",
        block: 1n
      };

      const newState = await stateEventsFilter.newStateByEvent(
        initialState,
        noteEvent
      );

      const expectedNewState = await newAccountAction.rawNewAccount(
        initialState,
        50n
      );

      expect(newState).not.toBeNull();
      if (!newState) {
        throw new Error("newState is null");
      }
      if (!expectedNewState) {
        throw new Error("expectedNewState is null");
      }

      expect(newState.currentNoteIndex).toBe(2n);
      expectStatesEqual(newState, expectedNewState);
    });

    it("should handle DepositNative event", async () => {
      const noteEvent: NoteEvent = {
        name: "DepositNative",
        amount: 25n,
        newNote: scalarToBigint(
          await cryptoClient.hasher.poseidonHash([Scalar.fromBigint(25n)])
        ),
        newNoteIndex: 3n,
        contractVersion: "0x000001",
        txHash: "0x123",
        block: 1n
      };

      const newState = await stateEventsFilter.newStateByEvent(
        initialState,
        noteEvent
      );
      const expectedNewState = await depositAction.rawDeposit(
        initialState,
        25n
      );

      expect(newState).not.toBeNull();
      if (!newState) {
        throw new Error("newState is null");
      }
      if (!expectedNewState) {
        throw new Error("expectedNewState is null");
      }

      expect(newState.currentNoteIndex).toBe(3n);
      expectStatesEqual(newState, expectedNewState);
    });

    it("should handle WithdrawNative event", async () => {
      const noteEvent: NoteEvent = {
        name: "WithdrawNative",
        amount: 10n,
        newNote: scalarToBigint(
          await cryptoClient.hasher.poseidonHash([Scalar.fromBigint(10n)])
        ),
        newNoteIndex: 4n,
        contractVersion: "0x000001",
        txHash: "0x123",
        block: 1n
      };

      const newState = await stateEventsFilter.newStateByEvent(
        initialState,
        noteEvent
      );
      const expectedNewState = await withdrawAction.rawWithdraw(
        initialState,
        10n
      );

      expect(newState).not.toBeNull();
      if (!newState) {
        throw new Error("newState is null");
      }
      if (!expectedNewState) {
        throw new Error("expectedNewState is null");
      }
      expect(newState?.currentNoteIndex).toBe(4n);
      expectStatesEqual(newState, expectedNewState);
    });

    it("should return null if action fails", async () => {
      const noteEvent: NoteEvent = {
        name: "WithdrawNative",
        amount: 200n,
        newNote: scalarToBigint(
          await cryptoClient.hasher.poseidonHash([Scalar.fromBigint(200n)])
        ),
        newNoteIndex: 4n,
        contractVersion: "0x000001",
        txHash: "0x123",
        block: 1n
      };

      const newState = await stateEventsFilter.newStateByEvent(
        initialState,
        noteEvent
      );

      expect(newState).toBeNull();
    });
  });

  describe("stateChangingEvents", () => {
    it("should filter only events that change state", async () => {
      const correctNewStateNote = (await depositAction.rawDeposit(
        initialState,
        50n
      ))!.currentNote;
      const noteEvents: NoteEvent[] = [
        // This event should be kept
        {
          name: "DepositNative",
          amount: 50n,
          newNote: scalarToBigint(correctNewStateNote),
          newNoteIndex: 2n,
          contractVersion: "0x000001",
          txHash: "0x1234",
          block: 1n
        },
        // This event should be filtered out
        {
          name: "DepositNative",
          amount: 25n,
          newNote: 1n,
          newNoteIndex: 2n,
          contractVersion: "0x000001",
          txHash: "0x4321",
          block: 1n
        }
      ];

      const filteredEvents = await stateEventsFilter.stateChangingEvents(
        initialState,
        noteEvents
      );

      expect(filteredEvents.length).toBe(1);
      expect(filteredEvents[0].name).toBe("DepositNative");
      expect(filteredEvents[0].txHash).toBe("0x1234");
    });

    it("should filter out events that do not change state", async () => {
      const invalidNote = 999999n; // Different from what would be calculated
      const noteEvents: NoteEvent[] = [
        {
          name: "NewAccountNative",
          amount: 50n,
          newNote: invalidNote, // This won't match the calculated note
          newNoteIndex: 2n,
          contractVersion: "0x000001",
          txHash: "0x123",
          block: 1n
        },
        {
          name: "WithdrawNative",
          amount: 10000n,
          newNote: invalidNote, // This won't match the calculated note
          newNoteIndex: 2n,
          contractVersion: "0x000001",
          txHash: "0x123",
          block: 1n
        }
      ];

      const filteredEvents = await stateEventsFilter.stateChangingEvents(
        initialState,
        noteEvents
      );

      expect(filteredEvents.length).toBe(0);
    });

    it("should handle empty events array", async () => {
      const filteredEvents = await stateEventsFilter.stateChangingEvents(
        initialState,
        []
      );

      expect(filteredEvents).toEqual([]);
    });
  });
});
