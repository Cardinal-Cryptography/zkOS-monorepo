import { Token } from "@/types";
import { IdManager } from "./idManager";
import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountStateMerkleIndexed } from "./types";
import { getAddressByToken } from "@/utils";

/**
 * Creates new account states and objects
 */
export class AccountFactory {
  constructor(private idManager: IdManager) {}

  /**
   * Creates an empty AccountState for a given token and account index
   */
  async createEmptyAccountState(
    token: Token
  ): Promise<AccountStateMerkleIndexed> {
    const tokenAddress = getAddressByToken(token);
    const id = await this.idManager.getId(tokenAddress);

    return {
      id,
      token,
      nonce: 0n,
      balance: 0n,
      currentNoteIndex: 0n,
      currentNote: Scalar.fromBigint(0n)
    };
  }
}
