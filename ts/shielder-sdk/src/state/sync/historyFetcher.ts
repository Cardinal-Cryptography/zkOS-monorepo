import { TokenAccountFinder } from "./tokenAccountFinder";
import { Token } from "@/types";
import { AccountFactory } from "../accountFactory";
import { ChainStateTransition } from "./chainStateTransition";

export class HistoryFetcher {
  constructor(
    private tokenAccountFinder: TokenAccountFinder,
    private accountFactory: AccountFactory,
    private chainStateTransition: ChainStateTransition
  ) {}

  async *getTransactionHistory() {
    let accountIndex = 0;
    while (true) {
      const token =
        await this.tokenAccountFinder.findTokenByAccountIndex(accountIndex);
      if (!token) break; // no more tokens to sync
      yield* this.getTransactionHistorySingleToken(token, accountIndex);
      accountIndex++;
    }
  }
  /**
   * Returns all the shielder transactions of the private account.
   * Note: This method is not efficient and should be used carefully.
   */
  async *getTransactionHistorySingleToken(token: Token, accountIndex: number) {
    let state = await this.accountFactory.createEmptyAccountState(
      token,
      accountIndex
    );
    while (true) {
      const stateTransition =
        await this.chainStateTransition.findStateTransition(state);
      if (!stateTransition) break;
      state = stateTransition.newState;
      yield stateTransition.transaction;
    }
  }
}
