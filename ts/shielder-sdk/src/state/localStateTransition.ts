import { DepositAction } from "@/actions/deposit";
import { NewAccountAction } from "@/actions/newAccount";
import { WithdrawAction } from "@/actions/withdraw";
import { NoteEvent } from "@/chain/contract";
import { AccountState, AccountStateMerkleIndexed } from "./types";

export class LocalStateTransition {
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
            noteEvent.amount - noteEvent.protocolFee
          );
        case "Deposit":
          return await this.depositAction.rawDeposit(
            state,
            noteEvent.amount - noteEvent.protocolFee
          );
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
}
