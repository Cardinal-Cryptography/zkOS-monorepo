import { AccountState } from "@/state";
import { DepositAction } from "@/actions/deposit";
import { NewAccountAction } from "@/actions/newAccount";
import { WithdrawAction } from "@/actions/withdraw";
import { NoteEvent } from "@/chain/contract";
import { scalarToBigint } from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountStateMerkleIndexed } from "./types";

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
  ): Promise<AccountStateMerkleIndexed | null> => {
    const getNewState = async () => {
      switch (noteEvent.name) {
        case "NewAccount":
          return await this.newAccountAction.rawNewAccount(
            state,
            noteEvent.amount
          );
        case "Deposit":
          return await this.depositAction.rawDeposit(state, noteEvent.amount);
        case "Withdraw":
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
