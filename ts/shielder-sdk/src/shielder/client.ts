import {
  Contract,
  IContract,
  VersionRejectedByContract
} from "@/chain/contract";
import {
  Address,
  createPublicClient,
  defineChain,
  Hash,
  http,
  PublicClient
} from "viem";
import { IRelayer, Relayer, VersionRejectedByRelayer } from "@/chain/relayer";
import { ShielderTransaction, StateManager } from "@/shielder/state";
import { NewAccountAction } from "@/shielder/actions/newAccount";
import { DepositAction } from "@/shielder/actions/deposit";
import { WithdrawAction } from "@/shielder/actions/withdraw";
import {
  StateSynchronizer,
  UnexpectedVersionInEvent
} from "@/shielder/state/sync";
import {
  createStorage,
  InjectedStorageInterface
} from "@/shielder/state/storageSchema";
import { Calldata } from "@/shielder/actions";
import { contractVersion } from "@/constants";
import { CustomError } from "ts-custom-error";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { StateEventsFilter } from "@/shielder/state/events";
import { INonceGenerator } from "./actions/utils";
import { idHidingNonce } from "@/utils";

export type ShielderOperation = "shield" | "withdraw" | "sync";

export class OutdatedSdkError extends CustomError {
  public constructor() {
    super("Contract version not supported by SDK");
  }
}

export interface ShielderCallbacks {
  /**
   * Fired after the calldata is generated.
   * @param calldata - calldata generated for the operation with some metadata
   * @param {ShielderOperation} operation - operation type
   */
  onCalldataGenerated?: (
    calldata: Calldata,
    operation: ShielderOperation
  ) => unknown;
  /**
   * Fired after the calldata is sent to chain/relayer.
   * @param txHash - transaction hash
   * @param {ShielderOperation} operation - operation type
   */
  onCalldataSent?: (
    txHash: `0x${string}`,
    operation: ShielderOperation
  ) => unknown;
  /**
   * Fired after the new transaction is found and tracked by shielder client.
   * This is the intended way to track the new transactions.
   * Note, that this callback may be called multiple times for the same transaction.
   * @param tx - new transaction
   */
  onNewTransaction?: (tx: ShielderTransaction) => unknown;
  /**
   * Fired when an error occurs during the generation or sending of the calldata, or during syncing.
   */
  onError?: (
    error: unknown,
    stage: "generation" | "sending" | "syncing",
    operation: ShielderOperation
  ) => unknown;
}

export type SendShielderTransaction = (params: {
  data: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
}) => Promise<Hash>;

export type QuotedFees = {
  // esimated base fee for the withdraw operation
  baseFee: bigint;
  // estimated relay fee for the withdraw operation
  relayFee: bigint;
  // total fee for the withdraw operation, is deducted from the
  // amount to withdraw, supposedly a sum of `baseFee` and `relayFee`
  totalFee: bigint;
};

/**
 * Factory method to create ShielderClient with the original configuration
 * @param {`0x${string}`} accountPrivateKey - private key of the account, in 32-byte hex format of ethereum's private key
 * @param {`0x${string}`} shielderSeedPrivateKey - seed private key for the shielder account, in 32-byte hex format of ethereum's private key
 * @param {number} chainId - chain id of the blockchain
 * @param {string} rpcHttpEndpoint - rpc http endpoint of the blockchain
 * @param {Address} contractAddress - address of the shielder contract
 * @param {string} relayerUrl - url of the relayer
 * @param {InjectedStorageInterface} storage - storage interface to manage the shielder state, must be isolated per shielder account
 * @param {ShielderCallbacks} callbacks - callbacks for the shielder actions
 */
export const createShielderClient = (
  shielderSeedPrivateKey: `0x${string}`,
  chainId: number,
  rpcHttpEndpoint: string,
  contractAddress: Address,
  relayerUrl: string,
  storage: InjectedStorageInterface,
  cryptoClient: CryptoClient,
  callbacks: ShielderCallbacks = {}
): ShielderClient => {
  const publicClient = createPublicClient({
    chain: defineChain({
      name: "chain",
      id: chainId,
      rpcUrls: {
        default: {
          http: [rpcHttpEndpoint]
        }
      },
      nativeCurrency: {
        name: "AZERO",
        symbol: "AZERO",
        decimals: 18
      }
    }),
    transport: http()
  });
  const contract = new Contract(publicClient, contractAddress);
  const relayer = new Relayer(relayerUrl);

  return new ShielderClient(
    shielderSeedPrivateKey,
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
   * @param {ShielderCallbacks} callbacks - callbacks for the shielder actions
   * @param {PublicClient} [publicClient] - viem's public client instance, used for waiting for the transaction receipt
   */
  constructor(
    shielderSeedPrivateKey: `0x${string}`,
    contract: IContract,
    relayer: IRelayer,
    storage: InjectedStorageInterface,
    publicClient: PublicClient,
    cryptoClient: CryptoClient,
    nonceGenerator: INonceGenerator,
    callbacks: ShielderCallbacks = {}
  ) {
    const internalStorage = createStorage(storage);
    this.stateManager = new StateManager(
      shielderSeedPrivateKey,
      internalStorage,
      cryptoClient
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
      nonceGenerator
    );
    const stateEventsFilter = new StateEventsFilter(
      this.newAccountAction,
      this.depositAction,
      this.withdrawAction
    );
    this.stateSynchronizer = new StateSynchronizer(
      this.stateManager,
      contract,
      cryptoClient,
      stateEventsFilter,
      callbacks.onNewTransaction
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
   * Syncs the shielder state with the blockchain.
   * Emits callbacks for the newly synced transaction.
   * Might have side effects, as it mutates the shielder state.
   * For the fresh storage and existing account being imported, it goes through the whole
   * shielder transactions history and updates the state, so it might be slow.
   * @returns new transactions, which were not yet synced
   * @throws {OutdatedSdkError} if cannot sync state due to unsupported contract version
   */
  async syncShielder() {
    try {
      return await this.handleVersionErrors(() => {
        return this.stateSynchronizer.syncAccountState();
      });
    } catch (error) {
      this.callbacks.onError?.(error, "syncing", "sync");
      throw error;
    }
  }

  /**
   * Get the current account state.
   * @returns the current account state
   */
  async accountState() {
    return await this.stateManager.accountState();
  }

  /**
   * Get the whole shielder transactions history.
   * Note, this method should be used with caution,
   * as it may fetch and return a large amount of data.
   * Instead, consider using callback `onNewTransaction` to track the new transactions.
   * @returns the shielder transactions
   * @throws {OutdatedSdkError} if cannot sync state due to unsupported contract version
   */
  async *scanChainForShielderTransactions() {
    try {
      for await (const transaction of this.stateSynchronizer.getShielderTransactions()) {
        yield transaction;
      }
    } catch (error) {
      // Rethrow to produce `OutdatedSdkError` if needed.
      try {
        await this.handleVersionErrors(() => {
          throw error;
        });
      } catch (error) {
        this.callbacks.onError?.(error, "syncing", "sync");
        throw error;
      }
    }
  }

  /**
   * Shield `amount` to the shielder account. Under the hood, it either creates a new account or deposits to the existing account.
   * Emits callbacks for the shielder actions.
   * Mutates the shielder state.
   * @param {bigint} amount - amount to shield, in wei
   * @param {SendShielderTransaction} sendShielderTransaction - function to send the shielder transaction to the blockchain
   * @param {`0x${string}`} from - public address of the sender
   * @returns transaction hash of the shield transaction
   * @throws {OutdatedSdkError} if cannot call the contract due to unsupported contract version
   */
  async shield(
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.stateManager.accountState();
    const txHash =
      state.nonce == 0n
        ? await this.newAccount(amount, sendShielderTransaction, from)
        : await this.deposit(amount, sendShielderTransaction, from);
    if (this.publicClient) {
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      await this.syncShielder();
    }
    return txHash;
  }

  /**
   * Withdraw `amount` to the `address` from the shielder account.
   * Emits callbacks for the shielder actions.
   * Mutates the shielder state.
   * @param {bigint} amount - amount to withdraw, in wei
   * @param {bigint} totalFee - total fee that is deducted from amount, in wei, supposedly a sum of base fee and relay fee
   * @param {`0x${string}`} address - public address of the recipient
   * @returns transaction hash of the withdraw transaction
   * @throws {OutdatedSdkError} if cannot call the relayer due to unsupported contract version
   */
  async withdraw(amount: bigint, totalFee: bigint, address: Address) {
    const state = await this.stateManager.accountState();
    const txHash = await this.handleCalldata(
      () =>
        this.withdrawAction.generateCalldata(
          state,
          amount,
          totalFee,
          address,
          contractVersion
        ),
      (calldata) => this.withdrawAction.sendCalldata(calldata),
      "withdraw"
    );
    if (this.publicClient) {
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
      await this.syncShielder();
    }
    return txHash;
  }

  private async newAccount(
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.stateManager.accountState();
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
    amount: bigint,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const state = await this.stateManager.accountState();
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
      calldata = await this.handleVersionErrors(generateCalldata);
    } catch (error) {
      this.callbacks.onError?.(error, "generation", operation);
      throw error;
    }
    this.callbacks.onCalldataGenerated?.(calldata, operation);

    try {
      const txHash = await this.handleVersionErrors(() => {
        return sendCalldata(calldata);
      });
      this.callbacks.onCalldataSent?.(txHash, operation);
      return txHash;
    } catch (error) {
      this.callbacks.onError?.(error, "sending", operation);
      throw error;
    }
  }

  private async handleVersionErrors<T>(func: () => Promise<T>): Promise<T> {
    try {
      return await func();
    } catch (err) {
      if (
        err instanceof VersionRejectedByContract ||
        err instanceof VersionRejectedByRelayer ||
        err instanceof UnexpectedVersionInEvent
      ) {
        throw new OutdatedSdkError();
      }
      throw err;
    }
  }
}
