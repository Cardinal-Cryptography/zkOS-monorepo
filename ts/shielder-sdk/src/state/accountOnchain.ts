import { IContract } from "@/chain/contract";
import { AccountStateMerkleIndexed } from "./types";
import { scalarToBigint } from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountNotOnChainError } from "@/errors";
import { BaseError, ContractFunctionRevertedError } from "viem";

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
      if (error instanceof BaseError) {
        const revertError = error.walk(
          (err) => err instanceof ContractFunctionRevertedError
        );
        if (revertError instanceof ContractFunctionRevertedError) {
          const errorName = revertError.data?.errorName ?? "";
          if (errorName === "LeafNotExisting") {
            throw new AccountNotOnChainError(
              `Account state with index ${accountState.currentNoteIndex} does not exist on-chain.`
            );
          }
        }
      }
    }

    if (!merklePath.includes(scalarToBigint(accountState.currentNote))) {
      throw new AccountNotOnChainError(
        `Account state with merkle index ${accountState.currentNoteIndex} does not match on-chain data.`
      );
    }
  }
}
