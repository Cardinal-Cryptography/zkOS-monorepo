import { IContract } from "@/chain/contract";
import { Scalar, scalarToBigint } from "@/crypto/scalar";
import { SendShielderTransaction } from "@/shielder/client";
import { rawAction } from "@/shielder/actions/utils";
import { AccountState } from "@/shielder/state";
import { NewAccountReturn } from "@/wasmClient";
import { wasmClientWorker } from "@/wasmClientWorker";

export interface NewAccountCalldata {
  calldata: NewAccountReturn;
  provingTimeMillis: number;
  amount: bigint;
}

export class NewAccountAction {
  contract: IContract;
  constructor(contract: IContract) {
    this.contract = contract;
  }

  static #balanceChange(currentBalance: bigint, amount: bigint) {
    return amount;
  }

  /**
   * Return the updated state after creating a new account with an initial deposit.
   * Does not perform the actual account creation on blockchain.
   * @param stateOld
   * @param amount initial deposit
   * @returns updated state
   */
  static async rawNewAccount(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await rawAction(stateOld, amount, NewAccountAction.#balanceChange);
  }

  /**
   * Generate calldata for creation of a new account with an initial deposit.
   * @param state current account state
   * @param amount initial deposit
   * @returns calldata for new account action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint
  ): Promise<NewAccountCalldata> {
    const { nullifier, trapdoor } = await wasmClientWorker.getSecrets(
      state.id,
      state.nonce
    );
    const time = Date.now();
    const calldata = await wasmClientWorker
      .proveAndVerifyNewAccount({
        id: state.id,
        nullifier,
        trapdoor,
        initialDeposit: Scalar.fromBigint(amount)
      })
      .catch((e) => {
        console.error(e);
        throw new Error(`Failed to prove new account: ${e}`);
      });
    const provingTime = Date.now() - time;
    return {
      calldata,
      provingTimeMillis: provingTime,
      amount
    };
  }

  /**
   * Create a new account with an initial deposit.
   * Calls the contract through RPC endpoint to create the account on the blockchain.
   * @param calldata calldata for new account action
   * @param sendShielderTransaction function to send the transaction to the blockchain
   * @returns transaction hash of the new account transaction
   */
  async sendCalldata(
    calldata: NewAccountCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      amount
    } = calldata;
    const encodedCalldata = await this.contract.newAccountCalldata(
      from,
      scalarToBigint(pubInputs.hNote),
      scalarToBigint(pubInputs.hId),
      amount,
      proof
    );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata,
      to: this.contract.getAddress(),
      value: amount
    }).catch((e) => {
      console.error(e);
      throw new Error(`Failed to create new account: ${e}`);
    });
    return txHash;
  }
}
