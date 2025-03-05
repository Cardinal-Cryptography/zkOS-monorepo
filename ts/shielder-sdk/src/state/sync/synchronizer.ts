import { Mutex } from "async-mutex";
import { Token } from "@/types";
import { StateTransitionFinder } from "./stateTransitionFinder";
import {
  AccountState,
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../types";
import { StateManager } from "../manager";

export class StateSynchronizer {
  constructor(
    private stateManager: StateManager,
    private stateTransitionFinder: StateTransitionFinder,
    private syncCallback?: (
      shielderTransaction: ShielderTransaction
    ) => unknown,
    private singleTokenMutex: Mutex = new Mutex()
  ) {}

  /**
   * Syncs the shielder state with the blockchain.
   * Emits the synced shielder transactions to the callback.
   * Locks to prevent concurrent storage changes.
   */
  async syncSingleAccount(token: Token) {
    await this.singleTokenMutex.runExclusive(async () => {
      let state: AccountState =
        (await this.stateManager.accountState(token)) ??
        (await this.stateManager.createEmptyAccountState(token));
      while (true) {
        const stateTransition =
          await this.stateTransitionFinder.findStateTransition(state);
        if (!stateTransition) break;
        if (this.syncCallback) this.syncCallback(stateTransition.transaction);
        const newState: AccountStateMerkleIndexed = stateTransition.newState;
        state = newState;
        await this.stateManager.updateAccountState(token, newState);
      }
    });
  }
}
