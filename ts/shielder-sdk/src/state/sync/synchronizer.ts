import { Mutex } from "async-mutex";
import { AccountRegistry } from "../accountRegistry";
import { TokenAccountFinder } from "./tokenAccountFinder";
import { Token } from "@/types";
import { StateTransitionFinder } from "./stateTransitionFinder";
import { ShielderTransaction } from "../types";

export class StateSynchronizer {
  constructor(
    private accountRegistry: AccountRegistry,
    private stateTransitionFinder: StateTransitionFinder,
    private tokenAccountFinder: TokenAccountFinder,
    private syncCallback?: (
      shielderTransaction: ShielderTransaction
    ) => unknown,
    private singleTokenMutex: Mutex = new Mutex(),
    private allTokensMutex: Mutex = new Mutex()
  ) {}

  /**
   * Syncs the shielder state with the blockchain.
   * Emits the synced shielder transactions to the callback.
   * Locks to prevent concurrent storage changes.
   */
  async syncAllAccounts() {
    await this.allTokensMutex.runExclusive(async () => {
      let accountIndex = 0;
      while (true) {
        let token =
          await this.accountRegistry.getTokenByAccountIndex(accountIndex);
        if (!token) {
          // try to find a token that has not been indexed yet
          token =
            await this.tokenAccountFinder.findTokenByAccountIndex(accountIndex);
        }
        if (!token) break; // no more tokens to sync
        await this.syncSingleAccount(token);
        accountIndex++;
      }
    });
  }

  /**
   * Syncs the shielder state with the blockchain.
   * Emits the synced shielder transactions to the callback.
   * Locks to prevent concurrent storage changes.
   */
  async syncSingleAccount(token: Token) {
    await this.singleTokenMutex.runExclusive(async () => {
      let state = await this.accountRegistry.getAccountState(token);
      while (true) {
        const stateTransition =
          await this.stateTransitionFinder.findStateTransition(state);
        if (!stateTransition) break;
        if (this.syncCallback) this.syncCallback(stateTransition.transaction);
        state = stateTransition.newState;
        await this.accountRegistry.updateAccountState(token, state);
      }
    });
  }
}
