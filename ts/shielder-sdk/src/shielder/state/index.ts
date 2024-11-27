import { Scalar, scalarsEqual, scalarToBigint } from "@/crypto/scalar";
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

  constructor(privateKey: Hex, storage: StorageInterface) {
    this.privateKey = privateKey;
    this.storage = storage;
  }

  async accountState(): Promise<AccountState> {
    const res = await this.storage.getItem("accountState");
    if (res) {
      const obj = res;
      if (
        !scalarsEqual(
          Scalar.fromBigint(BigInt(obj.id)),
          await wasmClientWorker.privateKeyToScalar(this.privateKey)
        )
      ) {
        throw new Error("Account id does not match private key.");
      }
      return {
        id: Scalar.fromBigint(BigInt(obj.id)),
        nonce: BigInt(obj.nonce),
        balance: BigInt(obj.balance),
        currentNote: Scalar.fromBigint(BigInt(obj.currentNote)),
        currentNoteIndex:
          obj.currentNoteIndex !== undefined
            ? BigInt(obj.currentNoteIndex)
            : undefined
      };
    }
    return await emptyAccountState(this.privateKey);
  }

  async updateAccountState(accountState: AccountState) {
    if (accountState.currentNoteIndex == undefined) {
      throw new Error("currentNoteIndex must be set.");
    }
    if (
      !scalarsEqual(
        accountState.id,
        await wasmClientWorker.privateKeyToScalar(this.privateKey)
      )
    ) {
      throw new Error("Account id does not match private key.");
    }
    await this.storage.setItem("accountState", {
      ...accountState,
      id: scalarToBigint(accountState.id),
      currentNote: scalarToBigint(accountState.currentNote)
    });
  }

  async emptyAccountState() {
    return await emptyAccountState(this.privateKey);
  }
}

const emptyAccountState = async (
  privateKey: `0x${string}`
): Promise<AccountState> => {
  return {
    /// Since the private key is an arbitrary 32byte number, this is a non-reversible mapping
    id: await wasmClientWorker.privateKeyToScalar(privateKey),
    nonce: 0n,
    balance: 0n,
    currentNote: Scalar.fromBigint(0n)
  };
};

export { storageSchema, InjectedStorageInterface, emptyAccountState };
