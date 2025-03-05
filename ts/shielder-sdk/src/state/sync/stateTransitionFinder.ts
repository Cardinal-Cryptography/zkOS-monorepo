import { IContract, NoteEvent } from "@/chain/contract";
import {
  CryptoClient,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { StateEventsFilter } from "@/state/events";
import { isVersionSupported } from "@/utils";
import {
  AccountState,
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../types";
import { Token } from "@/types";
import { OutdatedSdkError } from "@/errors";

export class StateTransitionFinder {
  constructor(
    private contract: IContract,
    private cryptoClient: CryptoClient,
    private stateEventsFilter: StateEventsFilter
  ) {}

  async findStateTransition(state: AccountStateMerkleIndexed): Promise<{
    newState: AccountStateMerkleIndexed;
    transaction: ShielderTransaction;
  } | null> {
    const event = await this.findStateTransitionEvent(state);
    if (!event) {
      return null;
    }
    const newState = await this.stateEventsFilter.newStateByEvent(state, event);
    if (!newState) {
      throw new Error("State is null, this should not happen");
    }
    state = newState;
    const transaction = eventToTransaction(event, state.token);
    return { newState, transaction };
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
    // pre-nullifier
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
   * @throws UnexpectedVersionInEvent
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
