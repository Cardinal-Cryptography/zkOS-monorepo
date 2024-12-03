import { Scalar, scalarToBigint } from "@/crypto/scalar";
import { wasmClientWorker } from "@/wasmClientWorker";
import { Address, Hex } from "viem";
import storageSchema, {
  InjectedStorageInterface,
  StorageInterface
} from "./storageSchema";
import { NoteEvent } from "@/chain/contract";

export type AccountState = {
  /**
   * Account id, a scalar derived from the private key.
   */
  id: Scalar;
  /**
   * Account nonce, increments for each new action.
   */
  nonce: bigint;
  /**
   * Account balance, in wei.
   */
  balance: bigint;
  /**
   * Hash of the last note.
   */
  currentNote: Scalar;
  /**
   * Merkle tree index of the last note.
   */
  currentNoteIndex?: bigint;
};

export type ShielderTransaction = {
  type: "NewAccountNative" | "DepositNative" | "WithdrawNative";
  amount: bigint;
  to?: Address;
  txHash: Hex;
  block: bigint;
};

export const eventToTransaction = (event: NoteEvent): ShielderTransaction => {
  return {
    type: event.name,
    amount: event.amount,
    to: event.to,
    txHash: event.txHash,
    block: event.block
  };
};

export class StateManager {
  private storage: StorageInterface;
  privateKey: Hex;
  id: Scalar | undefined;

  constructor(privateKey: Hex, storage: StorageInterface) {
    this.privateKey = privateKey;
    this.storage = storage;
  }

  async accountState(): Promise<AccountState> {
    const res = await this.storage.getItem("accountState");
    const id = await this.getId();
    if (res) {
      const obj = res;
      return {
        id,
        nonce: BigInt(obj.nonce),
        balance: BigInt(obj.balance),
        currentNote: Scalar.fromBigint(BigInt(obj.currentNote)),
        currentNoteIndex:
          obj.currentNoteIndex !== undefined
            ? BigInt(obj.currentNoteIndex)
            : undefined
      };
    }
    return await this.emptyAccountState();
  }

  async updateAccountState(accountState: AccountState) {
    if (accountState.currentNoteIndex == undefined) {
      throw new Error("currentNoteIndex must be set.");
    }
    await this.storage.setItem("accountState", {
      nonce: accountState.nonce,
      balance: accountState.balance,
      currentNote: scalarToBigint(accountState.currentNote),
      currentNoteIndex: accountState.currentNoteIndex
    });
  }

  async emptyAccountState() {
    return emptyAccountState(await this.getId());
  }

  private async getId(): Promise<Scalar> {
    if (!this.id) {
      this.id = await wasmClientWorker.privateKeyToScalar(this.privateKey);
    }
    return this.id;
  }
}

const emptyAccountState = (id: Scalar): AccountState => {
  return {
    /// Since the private key is an arbitrary 32byte number, this is a non-reversible mapping
    id,
    nonce: 0n,
    balance: 0n,
    currentNote: Scalar.fromBigint(0n)
  };
};

export { storageSchema, InjectedStorageInterface, emptyAccountState };
