import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { Address, Hash, PublicClient } from "viem";
import { Contract, IContract } from "@/chain/contract";
import { IRelayer, Relayer } from "@/chain/relayer";
import { contractVersion } from "@/constants";
import { idHidingNonce } from "@/utils";
import {
  QuotedFees,
  SendShielderTransaction,
  ShielderCallbacks,
  ShielderOperation
} from "./types";
import { Token } from "@/types";
import { ChainStateTransition } from "@/state/sync/chainStateTransition";
import { AccountFactory } from "@/state/accountFactory";
import { IdManager } from "@/state/idManager";
import {
  createStorage,
  InjectedStorageInterface
} from "@/storage/storageSchema";
import { StateManager } from "@/state/manager";
import { StateSynchronizer } from "@/state/sync/synchronizer";
import { HistoryFetcher } from "@/state/sync/historyFetcher";
import { LocalStateTransition } from "@/state/localStateTransition";
import { AccountStateMerkleIndexed, ShielderTransaction } from "@/state/types";
import { NewAccountAction } from "@/actions/newAccount";
import { DepositAction } from "@/actions/deposit";
import { WithdrawAction } from "@/actions/withdraw";
import { INonceGenerator } from "@/actions/utils";
import { Calldata } from "@/actions/types";

/**
 * Factory method to create ShielderClient with the original configuration
 * @param {`0x${string}`} shielderSeedPrivateKey - seed private key for the shielder account, in 32-byte hex format of ethereum's private key
 * @param {number} chainId - chain id of the blockchain
 * @param {string} rpcHttpEndpoint - rpc http endpoint of the blockchain
 * @param {Address} contractAddress - address of the shielder contract
 * @param {string} relayerUrl - url of the relayer
 * @param {InjectedStorageInterface} storage - storage interface to manage the shielder state, must be isolated per shielder account
 * @param {CryptoClient} cryptoClient - crypto client instance
 * @param {ShielderCallbacks} callbacks - callbacks for the shielder actions
 */
export const createShielderClient = (
  shielderSeedPrivateKey: `0x${string}`,
  chainId: number,
  publicClient: PublicClient,
  contractAddress: Address,
  relayerUrl: string,
  storage: InjectedStorageInterface,
  cryptoClient: CryptoClient,
  callbacks: ShielderCallbacks = {}
): ShielderClient => {
  const contract = new Contract(publicClient, contractAddress);
  const relayer = new Relayer(relayerUrl);

  return new ShielderClient(
    shielderSeedPrivateKey,
    chainId,
    contract,
    relayer,
    storage,
    publicClient,
    cryptoClient,
    {
      randomIdHidingNonce: () => idHidingNonce()
    },
    callbacks
  );
};

export class ShielderClient {
  private stateManager: StateManager;
  private stateSynchronizer: StateSynchronizer;
  private historyFetcher: HistoryFetcher;
  private newAccountAction: NewAccountAction;
  private depositAction: DepositAction;
  private withdrawAction: WithdrawAction;
  private callbacks: ShielderCallbacks;
  private relayer: IRelayer;
  private publicClient?: PublicClient;

  /**
   * Creates a new ShielderClient instance.
   * Please use the factory method `create` to create the instance. This constructor is not meant to be used directly.
   * @param {`0x${string}`} shielderSeedPrivateKey - seed private key for the shielder account, in 32-byte hex format of ethereum's private key
   * @param {IContract} contract - shielder contract, initialized with the public account actions
   * @param {IRelayer} relayer - relayer instance
   * @param {InjectedStorageInterface} storage - storage interface to manage the shielder state, must be isolated per shielder account
   * @param {PublicClient} publicClient - viem's public client instance, used for waiting for the transaction receipt
   * @param {CryptoClient} cryptoClient - crypto client instance
   * @param {INonceGenerator} nonceGenerator - nonce generator instance
   * @param {ShielderCallbacks} callbacks - callbacks for the shielder actions
   */
  constructor(
    shielderSeedPrivateKey: `0x${string}`,
    chainId: number,
    contract: IContract,
    relayer: IRelayer,
    storage: InjectedStorageInterface,
    publicClient: PublicClient,
    cryptoClient: CryptoClient,
    nonceGenerator: INonceGenerator,
    callbacks: ShielderCallbacks = {}
  ) {
    const internalStorage = createStorage(storage);
    const idManager = new IdManager(
      shielderSeedPrivateKey,
      BigInt(chainId),
      cryptoClient
    );
    const accountFactory = new AccountFactory(idManager);

    this.stateManager = new StateManager(
      internalStorage,
      idManager,
      accountFactory
    );
    this.newAccountAction = new NewAccountAction(contract, cryptoClient);
    this.depositAction = new DepositAction(
      contract,
      cryptoClient,
      nonceGenerator
    );
    this.withdrawAction = new WithdrawAction(
      contract,
      relayer,
      cryptoClient,
      nonceGenerator,
      BigInt(chainId)
    );
    const localStateTransition = new LocalStateTransition(
      this.newAccountAction,
      this.depositAction,
      this.withdrawAction
    );
    const chainStateTransition = new ChainStateTransition(
      contract,
      cryptoClient,
      localStateTransition
    );
    this.stateSynchronizer = new StateSynchronizer(
      this.stateManager,
      chainStateTransition,
      callbacks.onNewTransaction
    );
    this.historyFetcher = new HistoryFetcher(
      chainStateTransition,
      accountFactory
    );
    this.relayer = relayer;
    this.callbacks = callbacks;
    this.publicClient = publicClient;
  }

  /**
   * Get the fees for the withdraw operation.
   * @returns quoted fees for the withdraw operation
   */
  async getWithdrawFees(): Promise<QuotedFees> {
    const fees = await this.relayer.quoteFees();
    return {
      baseFee: fees.base_fee,
      relayFee: fees.relay_fee,
      totalFee: fees.total_fee
    };
  }

  /**
   * Syncs the shielder state with the blockchain for the given token.
   * Emits callbacks for the newly synced transaction.
   * Might have side effects, as it mutates the shielder state.
   * For the fresh storage and existing account being imported, it goes through the whole
   * shielder transactions history and updates the state, so it might be slow.
   * @returns new transactions, which were not yet synced
   * @param {Token} token - token to sync
   * @throws {OutdatedSdkError} if cannot sync state due to unsupported contract version
   */
  async syncShielderToken(token: Token) {
    try {
      return await this.stateSynchronizer.syncSingleAccount(token);
    } catch (error) {
      this.callbacks.onError?.(error, "syncing", "sync");
      throw error;
    }
  }

  /**
   * Get the current account state for token.
   * @param {Token} token - token to get the account state for
   * @returns the current account state
   */
  async accountState(token: Token) {
    return await this.stateManager.accountState(token);
  }

  /**
   * Get the whole shielder transactions history for a single token.
   * Note, this method should be used with caution,
   * as it may fetch and return a large amount of data.
   * Instead, consider using callback `onNewTransaction` to track the new transactions.
   * @param {Token} token - token to get the shielder transactions for
   * @returns the shielder transactions
   * @throws {OutdatedSdkError} if cannot sync state due to unsupported contract version
   */
  async *scanChainForTokenShielderTransactions(
    token: Token
  ): AsyncGenerator<ShielderTransaction, void, unknown> {
    yield* this.historyFetcher.getTransactionHistorySingleToken(token);
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
    const state = await this.stateManager.accountState(token);
    const txHash =
      state == null
        ? await this.newAccount(token, amount, sendShielderTransaction, from)
        : await this.deposit(state, amount, sendShielderTransaction, from);
    if (this.publicClient) {
      const txReceipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      if (txReceipt.status !== "success") {
        throw new Error("Shield transaction failed");
      }
      await this.syncShielderToken(token);
    }
    return txHash;
  }

  /**
   * Withdraw `amount` to the `address` from the shielder account using the configured relayer.
   * Emits callbacks for the shielder actions.
   * Mutates the shielder state.
   * @param {Token} token - token to withdraw
   * @param {bigint} amount - amount to withdraw, in wei
   * @param {bigint} totalFee - total fee that is deducted from amount, in wei, supposedly a sum of base fee and relay fee
   * @param {`0x${string}`} withdrawalAddress - public address of the recipient
   * @returns transaction hash of the withdraw transaction
   * @throws {OutdatedSdkError} if cannot call the relayer due to unsupported contract version
   */
  async withdraw(
    token: Token,
    amount: bigint,
    totalFee: bigint,
    withdrawalAddress: Address
  ) {
    const state = await this.stateManager.accountState(token);
    if (!state) {
      throw new Error("Account does not exist");
    }
    const relayerAddress = await this.relayer.address();
    const txHash = await this.handleCalldata(
      () =>
        this.withdrawAction.generateCalldata(
          state,
          amount,
          relayerAddress,
          totalFee,
          withdrawalAddress,
          contractVersion
        ),
      (calldata) => this.withdrawAction.sendCalldataWithRelayer(calldata),
      "withdraw"
    );
    if (this.publicClient) {
      const txReceipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      if (txReceipt.status !== "success") {
        throw new Error("Withdraw transaction failed");
      }
      await this.syncShielderToken(token);
    }
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
    withdrawalAddress: Address,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.stateManager.accountState(token);
    if (!state) {
      throw new Error("Account does not exist");
    }
    const txHash = await this.handleCalldata(
      () =>
        this.withdrawAction.generateCalldata(
          state,
          amount,
          from,
          0n, // totalFee is 0, as it is not used in this case
          withdrawalAddress,
          contractVersion
        ),
      (calldata) =>
        this.withdrawAction.sendCalldata(
          calldata,
          sendShielderTransaction,
          from
        ),
      "withdraw"
    );
    if (this.publicClient) {
      const txReceipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      if (txReceipt.status !== "success") {
        throw new Error("Withdraw transaction failed");
      }
      await this.syncShielderToken(token);
    }
    return txHash;
  }

  private async newAccount(
    token: Token,
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.stateManager.createEmptyAccountState(token);
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
}
