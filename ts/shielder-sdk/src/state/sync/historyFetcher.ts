import { Token } from "@/types";
import { ChainStateTransition } from "./chainStateTransition";
import { AccountFactory } from "../accountFactory";

export class HistoryFetcher {
  constructor(
    private chainStateTransition: ChainStateTransition,
    private accountFactory: AccountFactory
  ) {}
  /**
   * Returns all the shielder transactions of the private account.
   * Note: This method is not efficient and should be used carefully.
   */
  async *getTransactionHistorySingleToken(token: Token) {
    let state = await this.accountFactory.createEmptyAccountState(token);
    while (true) {
      const stateTransition =
        await this.chainStateTransition.findStateTransition(state);
      if (!stateTransition) break;
      state = stateTransition.newState;
      yield stateTransition.transaction;
    }
  }
}
