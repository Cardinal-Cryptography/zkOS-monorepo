import { Token } from "@/types";
import {
  SendShielderTransaction,
  ShielderCallbacks,
  ShielderOperation
} from "./types";
import { AccountRegistry } from "@/state/accountRegistry";
import { Hash, PublicClient } from "viem";
import { StateSynchronizer } from "@/state/sync/synchronizer";
import { IRelayer, quotedFeesFromTotalFee, QuotedFees } from "@/chain/relayer";
import { NewAccountAction } from "@/actions/newAccount";
import { DepositAction } from "@/actions/deposit";
import { WithdrawAction } from "@/actions/withdraw";
import { contractVersion } from "@/constants";
import { Calldata } from "@/actions/types";
import { AccountStateMerkleIndexed } from "@/state/types";

export class ShielderActions {
  constructor(
    private accountRegistry: AccountRegistry,
    private stateSynchronizer: StateSynchronizer,
    private relayer: IRelayer,
    private newAccountAction: NewAccountAction,
    private depositAction: DepositAction,
    private withdrawAction: WithdrawAction,
    private publicClient: PublicClient,
    private callbacks: ShielderCallbacks
  ) {}

  /**
   * Get the fees for the withdraw operation.
   * @returns quoted fees for the withdraw operation
   */
  async getWithdrawFees(): Promise<QuotedFees> {
    return await this.relayer.quoteFees();
  }

  /**
   * Shield `amount` to the shielder account. Under the hood, it either creates a new account or deposits to the existing account.
   * Emits callbacks for the shielder actions.
   * Mutates the shielder state.
   * @param {Token} token - token to shield
   * @param {bigint} amount - amount to shield, in wei
   * @param {SendShielderTransaction} sendShielderTransaction - function to send the shielder transaction to the blockchain
   * @param {`0x${string}`} from - public address of the sender
   * @returns transaction hash of the shield transaction
   * @throws {OutdatedSdkError} if cannot call the contract due to unsupported contract version
   */
  async shield(
    token: Token,
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.accountRegistry.getAccountState(token);
    const txHash =
      state === null
        ? await this.newAccount(token, amount, sendShielderTransaction, from)
        : await this.deposit(state, amount, sendShielderTransaction, from);

    await this.waitAndSync(token, txHash);

    return txHash;
  }

  /**
   * Withdraw `amount` to the `address` from the shielder account using the configured relayer.
   * Emits callbacks for the shielder actions.
   * Mutates the shielder state.
   * @param {Token} token - token to withdraw
   * @param {bigint} amount - amount to withdraw, in wei
   * @param {QuotedFees} quotedFees - fee info provided by the relayer
   * @param {`0x${string}`} withdrawalAddress - public address of the recipient
   * @param {bigint} pocketMoney - amount of native token to be sent to the recipient by the relayer; only for ERC20 withdrawals
   * @returns transaction hash of the withdraw transaction
   * @throws {OutdatedSdkError} if cannot call the relayer due to unsupported contract version
   */
  async withdraw(
    token: Token,
    amount: bigint,
    quotedFees: QuotedFees,
    withdrawalAddress: `0x${string}`,
    pocketMoney: bigint
  ) {
    const state = await this.accountRegistry.getAccountState(token);
    if (!state) {
      throw new Error("Account not found");
    }
    const relayerAddress = await this.relayer.address();
    const txHash = await this.handleCalldata(
      () =>
        this.withdrawAction.generateCalldata(
          state,
          amount,
          relayerAddress,
          quotedFees,
          withdrawalAddress,
          contractVersion,
          pocketMoney
        ),
      (calldata) => this.withdrawAction.sendCalldataWithRelayer(calldata),
      "withdraw"
    );

    await this.waitAndSync(token, txHash);

    return txHash;
  }

  /**
   * Withdraw `amount` to the `address` from the shielder account by sending the transaction directly to the shielder contract.
   * WARNING: This method is not recommended for production use, as it bypasses the relayer and makes withdrawal non-anonymous.
   * This method is useful when the relayer is not available or the user wants to withdraw the funds directly.
   * Emits callbacks for the shielder actions.
   * Mutates the shielder state.
   * @param {Token} token - token to withdraw
   * @param {bigint} amount - amount to withdraw, in wei
   * @param {`0x${string}`} withdrawalAddress - public address of the recipient
   * @param {SendShielderTransaction} sendShielderTransaction - function to send the shielder transaction to the blockchain
   * @param {`0x${string}`} from - public address of the sender
   * @returns transaction hash of the withdraw transaction
   * @throws {OutdatedSdkError} if cannot call the relayer due to unsupported contract version
   */
  async withdrawManual(
    token: Token,
    amount: bigint,
    withdrawalAddress: `0x${string}`,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.accountRegistry.getAccountState(token);
    if (!state) {
      throw new Error("Account not found");
    }
    const txHash = await this.handleCalldata(
      () =>
        this.withdrawAction.generateCalldata(
          state,
          amount,
          from,
          quotedFeesFromTotalFee(0n),
          withdrawalAddress,
          contractVersion,
          0n // pocketMoney is 0, as it is not used in this case
        ),
      (calldata) =>
        this.withdrawAction.sendCalldata(
          calldata,
          sendShielderTransaction,
          from
        ),
      "withdraw"
    );

    await this.waitAndSync(token, txHash);

    return txHash;
  }

  private async newAccount(
    token: Token,
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.accountRegistry.createEmptyAccountState(token);
    const txHash = await this.handleCalldata(
      () =>
        this.newAccountAction.generateCalldata(state, amount, contractVersion),
      (calldata) =>
        this.newAccountAction.sendCalldata(
          calldata,
          sendShielderTransaction,
          from
        ),
      "shield"
    );
    return txHash;
  }

  private async deposit(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const txHash = await this.handleCalldata(
      () => this.depositAction.generateCalldata(state, amount, contractVersion),
      (calldata) =>
        this.depositAction.sendCalldata(
          calldata,
          sendShielderTransaction,
          from
        ),
      "shield"
    );
    return txHash;
  }

  private async handleCalldata<T extends Calldata>(
    generateCalldata: () => Promise<T>,
    sendCalldata: (calldata: T) => Promise<Hash>,
    operation: ShielderOperation
  ): Promise<Hash> {
    let calldata: T;
    try {
      calldata = await generateCalldata();
    } catch (error) {
      this.callbacks.onError?.(error, "generation", operation);
      throw error;
    }
    this.callbacks.onCalldataGenerated?.(calldata, operation);

    try {
      const txHash = await sendCalldata(calldata);
      this.callbacks.onCalldataSent?.(txHash, operation);
      return txHash;
    } catch (error) {
      this.callbacks.onError?.(error, "sending", operation);
      throw error;
    }
  }

  private async waitAndSync(token: Token, txHash: Hash) {
    const txReceipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash
    });
    if (txReceipt.status !== "success") {
      throw new Error("Transaction failed");
    }
    await this.stateSynchronizer.syncSingleAccount(token);
  }
}
