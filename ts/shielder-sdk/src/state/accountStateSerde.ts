import {
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountObject, accountObjectSchema } from "../storage/storageSchema";
import { Token } from "@/types";
import { IdManager } from "./idManager";
import { AccountStateMerkleIndexed } from "./types";
import { getAddressByToken } from "@/utils";

export class AccountStateSerde {
  constructor(private idManager: IdManager) {}

  /**
   * Converts a storage-level AccountObject to a domain-level AccountState
   * with validation of the ID hash
   */
  async toAccountState(
    account: AccountObject,
    accountIndex: number,
    token: Token
  ): Promise<AccountStateMerkleIndexed> {
    // Validate ID hash during deserialization
    await this.idManager.validateIdHash(accountIndex, account.idHash);

    // Get the ID for this account index
    const id = await this.idManager.getId(accountIndex);

    return {
      id,
      token,
      nonce: BigInt(account.nonce),
      balance: BigInt(account.balance),
      currentNote: Scalar.fromBigint(BigInt(account.currentNote)),
      currentNoteIndex: BigInt(account.currentNoteIndex)
    };
  }

  /**
   * Converts a domain-level AccountState to a storage-level AccountObject
   */
  async toAccountObject(
    accountState: AccountStateMerkleIndexed,
    accountIndex: number
  ): Promise<AccountObject> {
    const tokenAddress = getAddressByToken(accountState.token);
    const idHash = await this.idManager.getIdHash(accountIndex);

    return accountObjectSchema.parse({
      idHash: scalarToBigint(idHash),
      nonce: accountState.nonce,
      balance: accountState.balance,
      currentNote: scalarToBigint(accountState.currentNote),
      currentNoteIndex: accountState.currentNoteIndex,
      tokenAddress
    });
  }
}
