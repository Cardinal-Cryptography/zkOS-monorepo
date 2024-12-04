import { IContract, VersionRejectedByContract } from "@/chain/contract";
import { Scalar, scalarToBigint } from "@/crypto/scalar";
import { SendShielderTransaction } from "@/shielder/client";
import { Calldata } from "@/shielder/actions";
import { rawAction } from "@/shielder/actions/utils";
import { AccountState } from "@/shielder/state";
import { DepositReturn } from "@/wasmClient";
import { wasmClientWorker } from "@/wasmClientWorker";

export interface DepositCalldata extends Calldata {
  calldata: DepositReturn;
  expectedContractVersion: `0x${string}`;
  amount: bigint;
  merkleRoot: Scalar;
}

export class DepositAction {
  contract: IContract;
  constructor(contract: IContract) {
    this.contract = contract;
  }

  static #balanceChange(currentBalance: bigint, amount: bigint) {
    return currentBalance + amount;
  }

  /**
   * Return the updated state after depositing `amount` into `stateOld`.
   * Does not perform the actual deposit on blockchain.
   * @param stateOld
   * @param amount amount to deposit
   * @returns updated state
   */
  static async rawDeposit(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await rawAction(stateOld, amount, this.#balanceChange);
  }

  /**
   * Generate calldata for depositing `amount` into the account.
   * @param state current account state
   * @param amount amount to deposit
   * @returns calldata for deposit action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint,
    expectedContractVersion: `0x${string}`
  ): Promise<DepositCalldata> {
    const lastNodeIndex = state.currentNoteIndex!;
    const [path, merkleRoot] = await wasmClientWorker.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    if (state.currentNoteIndex === undefined) {
      throw new Error("currentNoteIndex must be set");
    }

    const time = Date.now();

    const { nullifier: nullifierOld, trapdoor: trapdoorOld } =
      await wasmClientWorker.getSecrets(state.id, state.nonce - 1n);
    const { nullifier: nullifierNew, trapdoor: trapdoorNew } =
      await wasmClientWorker.getSecrets(state.id, state.nonce);

    const accountBalanceNew = DepositAction.#balanceChange(
      state.balance,
      amount
    );

    const calldata = await wasmClientWorker
      .proveAndVerifyDeposit({
        id: state.id,
        nullifierOld,
        trapdoorOld,
        accountBalanceOld: Scalar.fromBigint(state.balance),
        merkleRoot,
        path,
        value: Scalar.fromBigint(amount),
        nullifierNew,
        trapdoorNew,
        accountBalanceNew: Scalar.fromBigint(accountBalanceNew)
      })
      .catch((e) => {
        console.error(e);
        throw new Error(`Failed to prove deposit: ${e}`);
      });
    const provingTime = Date.now() - time;
    return {
      calldata,
      expectedContractVersion,
      provingTimeMillis: provingTime,
      amount,
      merkleRoot
    };
  }

  /**
   * Deposit `amount` into the account.
   * Calls the contract through RPC endpoint to perform the deposit on the blockchain.
   * @param calldata calldata for deposit action
   * @param sendShielderTransaction function to send the transaction to the blockchain
   * @returns transaction hash of the deposit transaction
   * @throws VersionRejectedByContract
   */
  async sendCalldata(
    calldata: DepositCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      amount,
      merkleRoot
    } = calldata;
    const encodedCalldata = await this.contract.depositCalldata(
      calldata.expectedContractVersion,
      from,
      scalarToBigint(pubInputs.idHiding),
      scalarToBigint(pubInputs.hNullifierOld),
      scalarToBigint(pubInputs.hNoteNew),
      scalarToBigint(merkleRoot),
      amount,
      proof
    );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata,
      to: this.contract.getAddress(),
      value: amount
    }).catch((e) => {
      if (e instanceof VersionRejectedByContract) {
        throw e;
      }
      console.error(e);
      throw new Error(`Failed to deposit: ${e}`);
    });
    return txHash;
  }
}
