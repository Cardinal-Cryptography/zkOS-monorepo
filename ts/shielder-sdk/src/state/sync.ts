import { IContract, NoteEvent } from "@/chain/contract";
import {
  CryptoClient,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { StateEventsFilter } from "@/state/events";
import { Mutex } from "async-mutex";
import { isVersionSupported } from "@/utils";
import { StateManager } from "./manager";
import { AccountState, ShielderTransaction } from "./types";
import { Token } from "@/types";
import { OutdatedSdkError } from "@/errors";

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
  async syncAccountState(token: Token) {
    await this.mutex.runExclusive(async () => {
      let state = await this.stateManager.accountState(token);
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
        const transaction = eventToTransaction(event, token);
        if (this.syncCallback) this.syncCallback(transaction);
        await this.stateManager.updateAccountState(token, state);
      }
    });
  }

  /**
   * Returns all the shielder transactions of the private account.
   * Note: This method is not efficient and should be used carefully.
   */
  async *getShielderTransactions(token: Token) {
    let state = await this.stateManager.emptyAccountState(token);
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
      const transaction = eventToTransaction(event, token);
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
   */
  private async findStateTransitionEvent(state: AccountState) {
    const nullifier = await this.getNullifier(state);
    const nullifierHash = await this.cryptoClient.hasher.poseidonHash([
      nullifier
    ]);

    const block = await this.contract.nullifierBlock(
      scalarToBigint(nullifierHash)
    );
    if (!block) {
      /// this is the last shielder transaction
      return null;
    }

    const event = await this.getNoteEventForBlock(state, block);

    if (!isVersionSupported(event.contractVersion)) {
      throw new OutdatedSdkError(
        `Unexpected version in event: ${event.contractVersion}`
      );
    }

    return event;
  }
}

const eventToTransaction = (
  event: NoteEvent,
  token: Token
): ShielderTransaction => {
  return {
    type: event.name,
    amount: event.amount,
    to: event.to,
    relayerFee: event.relayerFee,
    txHash: event.txHash,
    block: event.block,
    token
  };
};
