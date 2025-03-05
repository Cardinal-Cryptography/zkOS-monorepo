import {
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountState, AccountStateMerkleIndexed } from "./types";
import { storageSchemaVersion } from "@/constants";
import { Token } from "@/types";
import { getAddressByToken } from "@/utils";
import { StorageInterface } from "@/storage/storageSchema";
import { IdManager } from "./idManager";
import { AccountFactory } from "./accountFactory";

export class StateManager {
  constructor(
    private storage: StorageInterface,
    private idManager: IdManager,
    private accountFactory: AccountFactory
  ) {}

  async accountState(token: Token): Promise<AccountStateMerkleIndexed | null> {
    const tokenAddress = getAddressByToken(token);
    const res = await this.storage.getItem(tokenAddress);
    const id = await this.idManager.getId(tokenAddress);

    if (res) {
      await this.idManager.validateIdHash(tokenAddress, res.idHash);
      const obj = res;
      return {
        id,
        token,
        nonce: BigInt(obj.nonce),
        balance: BigInt(obj.balance),
        currentNote: Scalar.fromBigint(BigInt(obj.currentNote)),
        currentNoteIndex: BigInt(obj.currentNoteIndex)
      };
    }
    return null;
  }

  async createEmptyAccountState(token: Token): Promise<AccountState> {
    return await this.accountFactory.createEmptyAccountState(token);
  }

  async updateAccountState(
    token: Token,
    accountState: AccountStateMerkleIndexed
  ) {
    const tokenAddress = getAddressByToken(token);
    if (
      !scalarsEqual(accountState.id, await this.idManager.getId(tokenAddress))
    ) {
      throw new Error("New account id does not match the configured.");
    }
    const idHash = await this.idManager.getIdHash(tokenAddress);
    await this.storage.setItem(tokenAddress, {
      idHash: scalarToBigint(idHash),
      nonce: accountState.nonce,
      balance: accountState.balance,
      currentNote: scalarToBigint(accountState.currentNote),
      currentNoteIndex: accountState.currentNoteIndex,
      storageSchemaVersion: storageSchemaVersion
    });
  }
}
