import { IContract } from "@/chain/contract";
import { AccountStateMerkleIndexed } from "./types";
import { scalarToBigint } from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountNotOnChainError } from "@/errors";

export class AccountOnchain {
  constructor(private contract: IContract) {}

  async validateAccountState(
    accountState: AccountStateMerkleIndexed
  ): Promise<void> {
    let merklePath: readonly bigint[] = [];
    try {
      merklePath = await this.contract.getMerklePath(
        accountState.currentNoteIndex
      );
    } catch (error) {
      throw new AccountNotOnChainError(
        `Failed to fetch merkle path for account state with index ${accountState.currentNoteIndex}.`
      );
    }

    if (merklePath[0] !== scalarToBigint(accountState.currentNote)) {
      throw new AccountNotOnChainError(
        `Account state with merkle index ${accountState.currentNoteIndex} does not match on-chain data.`
      );
    }
  }
}
