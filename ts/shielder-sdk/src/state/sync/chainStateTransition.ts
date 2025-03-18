import { IContract, NoteEvent } from "@/chain/contract";
import {
  CryptoClient,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { LocalStateTransition } from "@/state/localStateTransition";
import { getAddressByToken, isVersionSupported } from "@/utils";
import {
  AccountState,
  AccountStateMerkleIndexed,
  ShielderTransaction
} from "../types";
import { Token } from "@/types";
import { OutdatedSdkError } from "@/errors";

export class ChainStateTransition {
  constructor(
    private contract: IContract,
    private cryptoClient: CryptoClient,
    private localStateTransition: LocalStateTransition
  ) {}

  async findStateTransition(state: AccountState): Promise<{
    newState: AccountStateMerkleIndexed;
    transaction: ShielderTransaction;
  } | null> {
    const nullifier = await this.getNullifier(state);
    const nullifierHashOrPrenullifier = nullifier
      ? await this.cryptoClient.hasher.poseidonHash([nullifier]) // nullifier hash
      : await this.cryptoClient.hasher.poseidonHash([state.id]); // prenullifier

    const block = await this.contract.nullifierBlock(
      scalarToBigint(nullifierHashOrPrenullifier)
    );
    if (!block) {
      /// this is the last shielder transaction
      return null;
    }
    return this.getNewStateByBlock(state, block);
  }

  private async getNewStateByBlock(state: AccountState, block: bigint) {
    const noteEvents = await this.contract.getNoteEventsFromBlock(block);

    const tokenAddress = getAddressByToken(state.token);

    const newStatesWithTxes: {
      newState: AccountStateMerkleIndexed;
      transaction: ShielderTransaction;
    }[] = [];
    for (const event of noteEvents) {
      if (!isVersionSupported(event.contractVersion)) {
        throw new OutdatedSdkError(
          `Unexpected version in event: ${event.contractVersion}`
        );
      }
      if (event.tokenAddress != tokenAddress) {
        throw new Error(
          `Unexpected token address in event: ${event.tokenAddress}`
        );
      }
      const newState = await this.localStateTransition.newStateByEvent(
        state,
        event
      );
      if (newState && scalarToBigint(newState.currentNote) == event.newNote) {
        newStatesWithTxes.push({
          newState,
          transaction: eventToTransaction(event, state.token)
        });
      }
    }

    if (newStatesWithTxes.length != 1) {
      throw new Error(
        `Unexpected number of events: ${newStatesWithTxes.length}, expected 1 event`
      );
    }

    return newStatesWithTxes[0];
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
    return null;
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
    token,
    pocketMoney: event.pocketMoney
  };
};
