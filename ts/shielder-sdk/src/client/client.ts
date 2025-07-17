import { Address } from "viem";
import { SendShielderTransaction, ShielderCallbacks } from "./types";
import { Token } from "@/types";
import { StateSynchronizer } from "@/state/sync/synchronizer";
import { HistoryFetcher } from "@/state/sync/historyFetcher";
import { ShielderTransaction } from "@/state/types";
import { AccountRegistry } from "@/state/accountRegistry";
import { ShielderActions } from "./actions";
import { ShielderComponents } from "./factories";
import { QuotedFees } from "@/chain/relayer";
import { handleShielderError } from "@/utils/errorHandler";
import { ProtocolFees, ProtocolFeeQuote } from "@/protocolFees";

export class ShielderClient {
  private accountRegistry: AccountRegistry;
  private stateSynchronizer: StateSynchronizer;
  private historyFetcher: HistoryFetcher;
  private shielderActions: ShielderActions;
  private protocolFees: ProtocolFees;
  private callbacks: ShielderCallbacks;

  /**
   * Creates a new ShielderClient instance.
   * Please use the factory method `create` to create the instance. This constructor is not meant to be used directly.
   * @param {ShielderComponents} components - components for the shielder client
   * @param {ShielderCallbacks} callbacks - callbacks for the shielder actions
   */
  constructor(components: ShielderComponents, callbacks: ShielderCallbacks) {
    this.accountRegistry = components.accountRegistry;
    this.stateSynchronizer = components.stateSynchronizer;
    this.historyFetcher = components.historyFetcher;
    this.shielderActions = components.shielderActions;
    this.protocolFees = components.protocolFees;
    this.callbacks = callbacks;
  }

  /**
   * Syncs the shielder state with the blockchain.
   * Emits callbacks for the newly synced transaction.
   * Might have side effects, as it mutates the shielder state.
   * For the fresh storage and existing account being imported, it goes through the whole
   * shielder transactions history and updates the state, so it might be slow.
   * @returns new transactions, which were not yet synced
   * @param {Token} token - token to sync
   * @throws {OutdatedSdkError} if cannot sync state due to unsupported contract version
   */
  async syncShielder() {
    try {
      return await this.stateSynchronizer.syncAllAccounts();
    } catch (error) {
      handleShielderError(error, this.callbacks, "syncing", "sync");
      throw error;
    }
  }

  /**
   * Get the list of all account states.
   * @returns the list of all account states
   */
  async accountStatesList() {
    return await this.accountRegistry.getAccountStatesList();
  }

  /**
   * Get the current account state for token.
   * @param {Token} token - token to get the account state for
   * @returns the current account state
   */
  async accountState(token: Token) {
    return await this.accountRegistry.getAccountState(token);
  }

  /**
   * Get the whole shielder transactions history.
   * Note, this method should be used with caution,
   * as it may fetch and return a large amount of data.
   * Instead, consider using callback `onNewTransaction` to track the new transactions.
   * @returns the shielder transactions
   * @throws {OutdatedSdkError} if cannot sync state due to unsupported contract version
   */
  async *scanChainForTokenShielderTransactions(): AsyncGenerator<
    ShielderTransaction,
    void,
    unknown
  > {
    try {
      for await (const transaction of this.historyFetcher.getTransactionHistory()) {
        yield transaction;
      }
    } catch (error) {
      handleShielderError(error, this.callbacks, "syncing", "sync");
      throw error;
    }
  }

  /**
   * Get the fees for the withdraw operation.
   * @returns quoted fees for the withdraw operation
   */
  async getRelayerFees(token: Token, pocketMoney: bigint): Promise<QuotedFees> {
    return await this.shielderActions.getRelayerFees(token, pocketMoney);
  }

  /**
   * Calculate protocol deposit fee amount.
   * @param {bigint} amount Amount on which to compute the protocol fee.
   * @param {boolean} [feeIncluded=true] Whether the protocol fee is included in the `amount` (default: `true`).
   * @returns {ProtocolFeeQuote} An object containing the total `amount` required for the deposit, and the `protocolFee` part.
   */
  async getProtocolShieldFee(
    amount: bigint,
    feeIncluded: boolean = true
  ): Promise<ProtocolFeeQuote> {
    return await this.protocolFees.getProtocolDepositFee(amount, feeIncluded);
  }

  /**
   * Calculate protocol withdraw fee amount.
   * @param {bigint} amount Amount on which to compute the protocol fee.
   * @param {boolean} [feeIncluded=true] Whether the protocol fee is included in the `amount`.
   * @returns {ProtocolFeeQuote} An object containing the total `amount` required for the withdrawal, and the `protocolFee` part.
   */
  async getProtocolWithdrawFee(
    amount: bigint,
    feeIncluded: boolean = true
  ): Promise<ProtocolFeeQuote> {
    return await this.protocolFees.getProtocolWithdrawFee(amount, feeIncluded);
  }

  /**
   * Fetches protocol deposit fee from the Contract and updates its state.
   * @returns {Promise<bigint>} Protocol deposit fee denoted in basis points.
   */
  async syncProtocolShieldFeeBps(): Promise<bigint> {
    return this.protocolFees.syncProtocolDepositFeeBps();
  }

  /**
   * Fetches protocol withdraw fee from the Contract and updates its state.
   * @returns {Promise<bigint>} Protocol withdraw fee denoted in basis points.
   */
  async syncProtocolWithdrawFeeBps(): Promise<bigint> {
    return await this.protocolFees.syncProtocolWithdrawFeeBps();
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
   * @param {bigint} protocolFee - Protocol fee amount, in wei. Part of the `amount`.
   * @param {Uint8Array} [memo=] - Bytes to be included as a part of the public transaction. (optional)
   * @throws {OutdatedSdkError} if cannot call the contract due to unsupported contract version
   */
  async shield(
    token: Token,
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`,
    protocolFee: bigint,
    memo?: Uint8Array
  ) {
    return this.shielderActions.shield(
      token,
      amount,
      sendShielderTransaction,
      from,
      protocolFee,
      memo ?? new Uint8Array()
    );
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
   * @param {bigint} protocolFee - Protocol fee amount, in wei. Part of the `amount`.
   * @param {Uint8Array} [memo=] - Bytes to be included as a part of the public transaction. (optional)
   * @returns transaction hash of the withdraw transaction
   * @throws {OutdatedSdkError} if cannot call the relayer due to unsupported contract version
   */
  async withdraw(
    token: Token,
    amount: bigint,
    quotedFees: QuotedFees,
    withdrawalAddress: Address,
    pocketMoney: bigint,
    protocolFee: bigint,
    memo?: Uint8Array
  ) {
    return this.shielderActions.withdraw(
      token,
      amount,
      quotedFees,
      withdrawalAddress,
      pocketMoney,
      protocolFee,
      memo ?? new Uint8Array()
    );
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
    withdrawalAddress: Address,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`,
    protocolFee: bigint,
    memo: Uint8Array
  ) {
    return this.shielderActions.withdrawManual(
      token,
      amount,
      withdrawalAddress,
      sendShielderTransaction,
      from,
      protocolFee,
      memo
    );
  }
}
