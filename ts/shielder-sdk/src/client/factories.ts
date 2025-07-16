import { NewAccountAction } from "@/actions/newAccount";
import { DepositAction } from "@/actions/deposit";
import { WithdrawAction } from "@/actions/withdraw";
import { Contract, IContract } from "@/chain/contract";
import { IRelayer, Relayer } from "@/chain/relayer";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { Address, PublicClient } from "viem";
import { ShielderCallbacks } from "./types";
import { ShielderClient } from "./client";
import { IdManager } from "@/state/idManager";
import { AccountFactory } from "@/state/accountFactory";
import { AccountRegistry } from "@/state/accountRegistry";
import { TokenAccountFinder } from "@/state/sync/tokenAccountFinder";
import { StateSynchronizer } from "@/state/sync/synchronizer";
import { HistoryFetcher } from "@/state/sync/historyFetcher";
import { ShielderActions } from "./actions";
import { AccountStateSerde } from "@/state/accountStateSerde";
import { StorageManager } from "@/storage/storageManager";
import {
  createStorage,
  InjectedStorageInterface,
  StorageInterface
} from "@/storage/storageSchema";
import { LocalStateTransition } from "@/state/localStateTransition";
import { ChainStateTransition } from "@/state/sync/chainStateTransition";
import { AccountOnchain } from "@/state/accountOnchain";
import { ProtocolFees } from "@/protocolFees";

// Base config with common properties
type BaseShielderConfig = {
  shielderSeedPrivateKey: `0x${string}`;
  chainId: bigint;
  storage: InjectedStorageInterface;
  cryptoClient: CryptoClient;
  publicClient: PublicClient;
  callbacks: ShielderCallbacks;
};

// Public config for creating a client
export type ShielderClientConfig = BaseShielderConfig & {
  contractAddress: Address;
  relayerUrl: string;
};

export type ShielderComponents = {
  accountRegistry: AccountRegistry;
  stateSynchronizer: StateSynchronizer;
  historyFetcher: HistoryFetcher;
  shielderActions: ShielderActions;
  protocolFees: ProtocolFees;
};

/**
 * Factory method to create ShielderClient with the original configuration
 * @param {ShielderClientConfig} config - configuration for the shielder client
 */
export const createShielderClient = (
  config: ShielderClientConfig
): ShielderClient => {
  const contract = new Contract(config.publicClient, config.contractAddress);
  const relayer = new Relayer(config.relayerUrl);

  const components = createShielderComponents({
    ...config,
    contract,
    relayer
  });

  return new ShielderClient(components, config.callbacks);
};

// Internal config for component creation
type ShielderComponentsConfig = BaseShielderConfig & {
  contract: IContract;
  relayer: IRelayer;
};

type IdentityComponents = {
  idManager: IdManager;
  accountFactory: AccountFactory;
};

type StorageComponents = {
  internalStorage: StorageInterface;
  accountRegistry: AccountRegistry;
};

type ActionComponents = {
  newAccountAction: NewAccountAction;
  depositAction: DepositAction;
  withdrawAction: WithdrawAction;
  localStateTransition: LocalStateTransition;
};

type SyncComponents = {
  chainStateTransition: ChainStateTransition;
  tokenAccountFinder: TokenAccountFinder;
  stateSynchronizer: StateSynchronizer;
  historyFetcher: HistoryFetcher;
};

function createShielderComponents(
  config: ShielderComponentsConfig
): ShielderComponents {
  const identityComponents = createIdentityComponents(config);

  const storageComponents = createStorageComponents({
    ...config,
    ...identityComponents
  });

  const actionComponents = createActionComponents(config);

  const syncComponents = createSyncComponents({
    ...config,
    ...actionComponents,
    ...storageComponents,
    ...identityComponents
  });

  const shielderActions = new ShielderActions(
    storageComponents.accountRegistry,
    syncComponents.stateSynchronizer,
    config.relayer,
    actionComponents.newAccountAction,
    actionComponents.depositAction,
    actionComponents.withdrawAction,
    config.publicClient,
    config.callbacks
  );

  const protocolFees = new ProtocolFees(config.contract);

  return {
    accountRegistry: storageComponents.accountRegistry,
    stateSynchronizer: syncComponents.stateSynchronizer,
    historyFetcher: syncComponents.historyFetcher,
    shielderActions,
    protocolFees
  };
}

function createIdentityComponents(config: ShielderComponentsConfig) {
  const idManager = new IdManager(
    config.shielderSeedPrivateKey,
    config.chainId,
    config.cryptoClient
  );
  const accountFactory = new AccountFactory(idManager);

  return { idManager, accountFactory };
}

function createStorageComponents(
  config: ShielderComponentsConfig & IdentityComponents
) {
  const internalStorage = createStorage(config.storage);

  const storageManager = new StorageManager(internalStorage);
  const accountStateSerde = new AccountStateSerde(config.idManager);

  const accountRegistry = new AccountRegistry(
    storageManager,
    config.accountFactory,
    accountStateSerde
  );

  return { internalStorage, accountRegistry };
}

function createActionComponents(config: ShielderComponentsConfig) {
  const newAccountAction = new NewAccountAction(
    config.contract,
    config.cryptoClient
  );
  const depositAction = new DepositAction(config.contract, config.cryptoClient);
  const withdrawAction = new WithdrawAction(
    config.contract,
    config.relayer,
    config.cryptoClient,
    config.chainId
  );
  const localStateTransition = new LocalStateTransition(
    newAccountAction,
    depositAction,
    withdrawAction
  );

  return {
    newAccountAction,
    depositAction,
    withdrawAction,
    localStateTransition
  };
}

function createSyncComponents(
  config: ShielderComponentsConfig &
    IdentityComponents &
    StorageComponents &
    ActionComponents
): SyncComponents {
  const chainStateTransition = new ChainStateTransition(
    config.contract,
    config.cryptoClient,
    config.localStateTransition
  );
  const tokenAccountFinder = new TokenAccountFinder(
    config.contract,
    config.cryptoClient,
    config.idManager
  );

  const accountOnchain = new AccountOnchain(config.contract);

  const stateSynchronizer = new StateSynchronizer(
    config.accountRegistry,
    chainStateTransition,
    tokenAccountFinder,
    accountOnchain,
    config.callbacks?.onNewTransaction
  );
  const historyFetcher = new HistoryFetcher(
    tokenAccountFinder,
    config.accountFactory,
    chainStateTransition
  );

  return {
    chainStateTransition,
    tokenAccountFinder,
    stateSynchronizer,
    historyFetcher
  };
}
