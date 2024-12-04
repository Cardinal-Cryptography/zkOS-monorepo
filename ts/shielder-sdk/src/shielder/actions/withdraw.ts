import { IContract } from "@/chain/contract";
import { Scalar, scalarToBigint } from "@/crypto/scalar";
import { AccountState } from "@/shielder/state";
import { wasmClientWorker } from "@/wasmClientWorker";
import { Address } from "viem";
import { relayerFee } from "@/constants";
import { IRelayer, VersionRejectedByRelayer } from "@/chain/relayer";
import { rawAction } from "@/shielder/actions/utils";
import { WithdrawReturn } from "@/crypto/circuits/withdraw";

export interface WithdrawCalldata {
  expectedContractVersion: `0x${string}`;
  calldata: WithdrawReturn;
  provingTimeMillis: number;
  amount: bigint;
  address: Address;
  merkleRoot: Scalar;
}

export class WithdrawAction {
  contract: IContract;
  relayer: IRelayer;

  constructor(contract: IContract, relayer: IRelayer) {
    this.contract = contract;
    this.relayer = relayer;
  }

  static #balanceChange(currentBalance: bigint, amount: bigint) {
    return currentBalance - amount;
  }

  /**
   * Return the updated state after withdrawing `amount` from `stateOld`.
   * Does not perform the actual withdrawal on blockchain.
   * @param stateOld
   * @param amount amount to withdraw
   * @returns updated state
   */
  static async rawWithdraw(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await rawAction(stateOld, amount, WithdrawAction.#balanceChange);
  }

  /**
   * Generate calldata for withdrawing `amount` from the account.
   * The amount must include the relayer fee, e.g. `amount = value + relayerFee`,
   * where `value` is the targeted amount to withdraw.
   * @param state current account state
   * @param amount amount to withdraw, including the relayer fee
   * @param address recipient address
   * @returns calldata for withdrawal action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint,
    address: Address,
    expectedContractVersion: `0x${string}`
  ): Promise<WithdrawCalldata> {
    const lastNodeIndex = state.currentNoteIndex!;
    const [path, merkleRoot] = await wasmClientWorker.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    if (state.currentNoteIndex === undefined) {
      throw new Error("currentNoteIndex must be set");
    }
    if (state.balance < amount) {
      throw new Error("Insufficient funds");
    }
    if (amount < relayerFee) {
      throw new Error(
        `Amount must be greater than the relayer fee: ${relayerFee.toString()}`
      );
    }

    const time = Date.now();

    const { nullifier: nullifierOld, trapdoor: trapdoorOld } =
      await wasmClientWorker.getSecrets(state.id, state.nonce - 1n);
    const { nullifier: nullifierNew, trapdoor: trapdoorNew } =
      await wasmClientWorker.getSecrets(state.id, state.nonce);

    const accountBalanceNew = WithdrawAction.#balanceChange(
      state.balance,
      amount
    );

    const calldata = await wasmClientWorker
      .proveAndVerifyWithdraw({
        id: state.id,
        nullifierOld,
        trapdoorOld,
        accountBalanceOld: Scalar.fromBigint(state.balance),
        merkleRoot,
        path,
        value: Scalar.fromBigint(amount),
        nullifierNew,
        trapdoorNew,
        accountBalanceNew: Scalar.fromBigint(accountBalanceNew),
        relayerAddress: Scalar.fromAddress(this.relayer.address),
        relayerFee: Scalar.fromBigint(relayerFee),
        address: Scalar.fromAddress(address)
      })
      .catch((e) => {
        console.error(e);
        throw new Error(`Failed to prove withdrawal: ${e}`);
      });
    const provingTime = Date.now() - time;
    return {
      expectedContractVersion,
      calldata,
      provingTimeMillis: provingTime,
      amount,
      address,
      merkleRoot
    };
  }

  /**
   * Withdraw `amount` from the account.
   * Calls the relayer to perform the withdrawal on the blockchain.
   * @param calldata calldata for withdrawal action
   * @returns transaction hash of the withdraw transaction
   * @throws VersionRejectedByRelayer
   */
  async sendCalldata(calldata: WithdrawCalldata) {
    const {
      expectedContractVersion,
      calldata: { pubInputs, proof },
      amount,
      address,
      merkleRoot
    } = calldata;
    const { tx_hash: txHash } = await this.relayer
      .withdraw(
        expectedContractVersion,
        scalarToBigint(pubInputs.idHiding),
        scalarToBigint(pubInputs.hNullifierOld),
        scalarToBigint(pubInputs.hNoteNew),
        scalarToBigint(merkleRoot),
        amount,
        proof,
        address
      )
      .catch((e) => {
        if (e instanceof VersionRejectedByRelayer) {
          throw e;
        }
        console.error(e);
        throw new Error(`Failed to withdraw: ${e}`);
      });
    return txHash;
  }
}
