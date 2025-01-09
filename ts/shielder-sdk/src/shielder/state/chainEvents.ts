import { AccountState } from "@/shielder/state";
import { DepositAction } from "@/shielder/actions/deposit";
import { NewAccountAction } from "@/shielder/actions/newAccount";
import { WithdrawAction } from "@/shielder/actions/withdraw";
import { NoteEvent } from "@/chain/contract";
import { scalarToBigint } from "shielder-sdk-crypto";

export const newStateByEvent = async (
  state: AccountState,
  noteEvent: NoteEvent
): Promise<AccountState | null> => {
  const getNewState = async () => {
    switch (noteEvent.name) {
      case "NewAccountNative":
        return await NewAccountAction.rawNewAccount(state, noteEvent.amount);
      case "DepositNative":
        return await DepositAction.rawDeposit(state, noteEvent.amount);
      case "WithdrawNative":
        return await WithdrawAction.rawWithdraw(state, noteEvent.amount);
    }
  };
  const newState = await getNewState();
  if (newState === null) {
    return null;
  }
  return {
    ...newState,
    currentNoteIndex: noteEvent.newNoteIndex
  };
};

export const stateChangingEvents = async (
  state: AccountState,
  noteEvents: NoteEvent[]
): Promise<NoteEvent[]> => {
  const filteredEvents: NoteEvent[] = [];
  for (const event of noteEvents) {
    const newState = await newStateByEvent(state, event);
    if (newState && scalarToBigint(newState.currentNote) == event.newNote) {
      filteredEvents.push(event);
    }
  }
  return filteredEvents;
};
