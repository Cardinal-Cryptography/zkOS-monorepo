import { AccountState } from "@/shielder/state";
import { DepositAction } from "@/shielder/actions/deposit";
import { NewAccountAction } from "@/shielder/actions/newAccount";
import { WithdrawAction } from "@/shielder/actions/withdraw";
import { NoteEvent } from "@/chain/contract";
import { scalarToBigint } from "shielder-sdk-crypto";

export class StateEventsFilter {
  newAccountAction: NewAccountAction;
  depositAction: DepositAction;
  withdrawAction: WithdrawAction;

  constructor(
    newAccountAction: NewAccountAction,
    depositAction: DepositAction,
    withdrawAction: WithdrawAction
  ) {
    this.newAccountAction = newAccountAction;
    this.depositAction = depositAction;
    this.withdrawAction = withdrawAction;
  }
  newStateByEvent = async (
    state: AccountState,
    noteEvent: NoteEvent
  ): Promise<AccountState | null> => {
    const getNewState = async () => {
      switch (noteEvent.name) {
        case "NewAccountNative":
          return await this.newAccountAction.rawNewAccount(
            state,
            noteEvent.amount
          );
        case "DepositNative":
          return await this.depositAction.rawDeposit(state, noteEvent.amount);
        case "WithdrawNative":
          return await this.withdrawAction.rawWithdraw(state, noteEvent.amount);
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

  stateChangingEvents = async (
    state: AccountState,
    noteEvents: NoteEvent[]
  ): Promise<NoteEvent[]> => {
    const filteredEvents: NoteEvent[] = [];
    for (const event of noteEvents) {
      const newState = await this.newStateByEvent(state, event);
      if (newState && scalarToBigint(newState.currentNote) == event.newNote) {
        filteredEvents.push(event);
      }
    }
    return filteredEvents;
  };
}
