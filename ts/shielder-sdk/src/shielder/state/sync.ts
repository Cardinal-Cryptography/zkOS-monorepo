import { CustomError } from "ts-custom-error";
import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import {
  AccountState,
  eventToTransaction,
  ShielderTransaction,
  StateManager
} from "@/shielder/state";
import { StateEventsFilter } from "@/shielder/state/events";
import { Mutex } from "async-mutex";
import { isVersionSupported } from "@/utils";

export class UnexpectedVersionInEvent extends CustomError {
  public constructor(message: string) {
    super(`Unexpected version in event: ${message}`);
  }
}

export class StateSynchronizer {
  private contract: IContract;
  private stateManager: StateManager;
  private cryptoClient: CryptoClient;
  private stateEventsFilter: StateEventsFilter;
  private syncCallback?: (shielderTransaction: ShielderTransaction) => unknown;
  private mutex: Mutex;
  constructor(
    stateManager: StateManager,
    contract: IContract,
    cryptoClient: CryptoClient,
    stateEventsFilter: StateEventsFilter,
    syncCallback?: (shielderTransaction: ShielderTransaction) => unknown
  ) {
    this.stateManager = stateManager;
    this.contract = contract;
    this.cryptoClient = cryptoClient;
    this.stateEventsFilter = stateEventsFilter;
    this.syncCallback = syncCallback;
    this.mutex = new Mutex();
  }

  /**
   * Syncs the shielder state with the blockchain.
   * Emits the synced shielder transactions to the callback.
   * Locks to prevent concurrent storage changes.
   */
  async syncAccountState() {
    await this.mutex.runExclusive(async () => {
      let state = await this.stateManager.accountState();
      while (true) {
        const event = await this.findStateTransitionEvent(state);
        if (!event) {
          break;
        }
        const newState = await this.stateEventsFilter.newStateByEvent(
          state,
          event
        );
        if (!newState) {
          throw new Error("State is null, this should not happen");
        }
        state = newState;
        const transaction = eventToTransaction(event);
        if (this.syncCallback) this.syncCallback(transaction);
        await this.stateManager.updateAccountState(state);
      }
    });
  }

  /**
   * Returns all the shielder transactions of the private account.
   * Note: This method is not efficient and should be used carefully.
   */
  async *getShielderTransactions() {
    let state = await this.stateManager.emptyAccountState();
    while (true) {
      const event = await this.findStateTransitionEvent(state);
      if (!event) break;
      const newState = await this.stateEventsFilter.newStateByEvent(
        state,
        event
      );
      if (!newState) {
        throw new Error("State is null, this should not happen");
      }
      state = newState;
      const transaction = eventToTransaction(event);
      yield transaction;
    }
  }

  private async getNullifier(state: AccountState) {
    if (state.nonce > 0n) {
      return (
        await this.cryptoClient.secretManager.getSecrets(
          state.id,
          Number(state.nonce - 1n)
        )
      ).nullifier;
    }
    return state.id;
  }

  private async getNoteEventForBlock(state: AccountState, block: bigint) {
    const events = await this.stateEventsFilter.stateChangingEvents(
      state,
      await this.contract.getNoteEventsFromBlock(block)
    );

    if (events.length != 1) {
      console.error(events);
      throw new Error(
        `Unexpected number of events: ${events.length}, expected 1 event`
      );
    }

    return events[0];
  }

  /**
   * Finds the next state transition event for the given state, emitted in shielder contract.
   * @param state - account state
   * @returns the next state transition event
   * @throws UnexpectedVersionInEvent
   */
  private async findStateTransitionEvent(state: AccountState) {
    const nullifier = await this.getNullifier(state);

    const block = await this.contract.nullifierBlock(
      scalarToBigint(await this.cryptoClient.hasher.poseidonHash([nullifier]))
    );
    if (!block) {
      /// this is the last shielder transaction
      return null;
    }

    const event = await this.getNoteEventForBlock(state, block);

    if (!isVersionSupported(event.contractVersion)) {
      throw new UnexpectedVersionInEvent(`${event.contractVersion}`);
    }

    return event;
  }
}
