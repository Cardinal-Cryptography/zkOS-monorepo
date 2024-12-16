/* eslint-disable @typescript-eslint/no-namespace */

import type { Remote } from "comlink";
import { useEffect } from "react";

import {
  Converter,
  Deposit,
  type DepositValues,
  flatUint8,
  Hasher,
  NewAccount,
  type NewAccountValues,
  Scalar,
  SecretGenerator,
  wasmClientWorker,
  WasmClientWorker,
  Withdraw,
  type WithdrawValues,
  isBigintScalar,
  scalarToBigint,
  Contract,
  type AccountState,
  emptyAccountState,
  type NoteEvent,
  NewAccountAction,
  stateChangingEvents,
  DepositAction,
  newStateByEvent,
  ShielderClient,
  Relayer,
  WithdrawAction,
  type InjectedStorageInterface,
  type ShielderCallbacks,
  type IContract,
  type IRelayer,
  scalarsEqual,
  createShielderClient,
  wasmClientWorkerInit,
  singlethreaded_wasm,
  multithreaded_wasm,
  type SendShielderTransaction,
} from "shielder-sdk/__internal__";

import {
  exampleDepositValues,
  exampleNewAccountValues,
  exampleWithdrawValues,
  generateMerklePath,
  generateNoteHash,
  getCaller,
  navigatorHardwareConcurrencyOrThreadsOverrideFromEnv,
} from "@/crypto/testUtils";
import type { Address } from "viem";
import { generatePrivateKey } from "viem/accounts";
import {
  BalanceManager,
  getEvent,
  getValidatedEvent,
  getValidatedMerklePath,
  setupContractTest,
  type ContractTestFixture,
} from "@/chain/testUtils";
import { mockedStorage } from "@/storage/mockedStorage";
import {
  mockedServices,
  type MockedContract,
  type MockedRelayer,
} from "@/shielder/testUtils";
import type { PublicClient } from "viem";

declare global {
  interface Window {
    wasmModule: {
      init: () => Promise<number>;
    };

    wasmClientWorker: {
      isReady: () => Promise<number>;
      getWorker: () => Remote<WasmClientWorker>;
    };

    utils: {
      flatUint8: (value: Uint8Array[]) => Uint8Array;
    };

    crypto: {
      testUtils: {
        generateNoteHash: (
          hasher: Hasher,
          noteVersion: Scalar,
          id: Scalar,
          nullifierOld: Scalar,
          trapdoorOld: Scalar,
          accountBalanceOld: Scalar,
        ) => Scalar;
        generateMerklePath: (
          hasher: Hasher,
          leaf: Scalar,
        ) => [Scalar, Uint8Array];

        exampleNewAccountValues: () => NewAccountValues;
        exampleDepositValues: (hasher: Hasher) => DepositValues;
        exampleWithdrawValues: (hasher: Hasher) => WithdrawValues;
      };

      scalar: {
        isBigintScalar: (value: bigint) => boolean;
        fromBigint: (value: bigint) => Scalar;
        scalarToBigint: (scalar: Scalar) => bigint;
        fromAddress: (address: `0x${string}`) => Scalar;
        scalarsEqual: (a: Scalar, b: Scalar) => boolean;
      };

      createConverter: () => Converter;
      createDepositCircuit: () => Deposit;
      createHasher: () => Hasher;
      createNewAccountCircuit: () => NewAccount;
      createSecretGenerator: () => SecretGenerator;
      createWithdrawCircuit: () => Withdraw;
    };

    chain: {
      generatePrivateKey: () => `0x${string}`;
      createContract: (account: PublicClient, address: Address) => Contract;
      createRelayer: (url: string) => Relayer;

      testUtils: {
        createBalanceManager: (
          chainId: number,
          rpcHttpEndpoint: string,
          testnetPrivateKey: `0x${string}`,
        ) => BalanceManager;
        getValidatedMerklePath: (
          merkleTreeIdx: bigint,
          contract: Contract,
          note: Scalar,
        ) => Promise<readonly bigint[]>;
        getEvent: (
          contract: Contract,
          state: AccountState,
          blockNumber: bigint,
        ) => Promise<NoteEvent>;
        getValidatedEvent: (
          contract: Contract,
          state: AccountState,
          blockNumber: bigint,
          expectedAmount: bigint,
          expectedNewNote: Scalar,
        ) => Promise<NoteEvent>;
        setupContractTest: (
          initialPublicBalance: bigint,
          chainConfig: {
            chainId: number;
            rpcHttpEndpoint: string;
            contractAddress: `0x${string}`;
            testnetPrivateKey: `0x${string}`;
          },
          privateKeyAlice: `0x${string}`,
          relayerConfig?: {
            url: string;
          },
        ) => Promise<ContractTestFixture>;
      };
    };

    state: {
      emptyAccountState: (id: Scalar) => AccountState;
      stateChangingEvents: (
        state: AccountState,
        noteEvents: NoteEvent[],
      ) => Promise<NoteEvent[]>;
      newStateByEvent: (
        state: AccountState,
        noteEvent: NoteEvent,
      ) => Promise<AccountState | null>;
    };

    shielder: {
      actions: {
        createNewAccountAction: (contract: Contract) => NewAccountAction;
        createDepositAction: (contract: Contract) => DepositAction;
        createWithdrawAction: (
          contract: Contract,
          relayer: Relayer,
        ) => WithdrawAction;
      };
      testUtils: {
        mockedServices: (userAddress: `0x${string}`) => {
          contract: MockedContract;
          relayer: MockedRelayer;
          storage: InjectedStorageInterface;
          publicClient: PublicClient;
          sendTx: SendShielderTransaction;
        };
      };
      createShielderClient: (
        shielderSeedPrivateKey: `0x${string}`,
        chainId: number,
        rpcHttpEndpoint: string,
        contractAddress: Address,
        relayerUrl: string,
        storage: InjectedStorageInterface,
      ) => ShielderClient;
      createShielderClientManually: (
        shielderSeedPrivateKey: `0x${string}`,
        contract: IContract,
        relayer: IRelayer,
        storage: InjectedStorageInterface,
        publicClient: PublicClient,
        callbacks?: ShielderCallbacks,
      ) => ShielderClient;
    };

    storage: {
      mockedStorage: (address: `0x${string}`) => InjectedStorageInterface;
    };
  }
}

function EntryPoint() {
  useEffect(() => {
    window.wasmModule = window.wasmModule || {};
    window.wasmModule.init = wasmModuleImpl.init;

    window.wasmClientWorker = window.wasmClientWorker || {};
    window.wasmClientWorker.isReady = wasmClientWorkerImpl.isReady;
    window.wasmClientWorker.getWorker = () => wasmClientWorker;

    window.utils = window.utils || {};
    window.utils.flatUint8 = (value) => flatUint8(value);

    // Expose crypto utilities
    window.crypto.testUtils = window.crypto.testUtils || {};
    window.crypto.testUtils.generateNoteHash = generateNoteHash;
    window.crypto.testUtils.generateMerklePath = generateMerklePath;
    window.crypto.testUtils.exampleNewAccountValues = exampleNewAccountValues;
    window.crypto.testUtils.exampleDepositValues = exampleDepositValues;
    window.crypto.testUtils.exampleWithdrawValues = exampleWithdrawValues;

    window.crypto.scalar = window.crypto.scalar || {};
    window.crypto.scalar.isBigintScalar = isBigintScalar;
    window.crypto.scalar.fromBigint = Scalar.fromBigint;
    window.crypto.scalar.scalarToBigint = scalarToBigint;
    window.crypto.scalar.fromAddress = Scalar.fromAddress;
    window.crypto.scalar.scalarsEqual = scalarsEqual;

    window.crypto.createConverter = () => new Converter(getCaller());
    window.crypto.createDepositCircuit = () => new Deposit(getCaller());
    window.crypto.createHasher = () => new Hasher(getCaller());
    window.crypto.createNewAccountCircuit = () => new NewAccount(getCaller());
    window.crypto.createSecretGenerator = () =>
      new SecretGenerator(getCaller());
    window.crypto.createWithdrawCircuit = () => new Withdraw(getCaller());

    // Expose chain utilities
    window.chain = window.chain || {};
    window.chain.generatePrivateKey = generatePrivateKey;
    window.chain.createContract = (account: PublicClient, address: Address) =>
      new Contract(account, address);
    window.chain.createRelayer = (url: string) => new Relayer(url);

    window.chain.testUtils = window.chain.testUtils || {};
    window.chain.testUtils.createBalanceManager = (
      chainId: number,
      rpcHttpEndpoint: string,
      testnetPrivateKey: `0x${string}`,
    ) => new BalanceManager(chainId, rpcHttpEndpoint, testnetPrivateKey);
    window.chain.testUtils.getValidatedMerklePath = getValidatedMerklePath;
    window.chain.testUtils.getEvent = getEvent;
    window.chain.testUtils.getValidatedEvent = getValidatedEvent;
    window.chain.testUtils.setupContractTest = setupContractTest;
    // Expose state utilities
    window.state = window.state || {};
    window.state.emptyAccountState = emptyAccountState;
    window.state.stateChangingEvents = stateChangingEvents;
    window.state.newStateByEvent = newStateByEvent;
    // Expose shielder utilities
    window.shielder = window.shielder || {};
    window.shielder.createShielderClient = (
      shielderSeedPrivateKey: `0x${string}`,
      chainId: number,
      rpcHttpEndpoint: string,
      contractAddress: Address,
      relayerUrl: string,
      storage: InjectedStorageInterface,
    ) =>
      createShielderClient(
        shielderSeedPrivateKey,
        chainId,
        rpcHttpEndpoint,
        contractAddress,
        relayerUrl,
        storage,
      );
    window.shielder.createShielderClientManually = (
      shielderSeedPrivateKey: `0x${string}`,
      contract: IContract,
      relayer: IRelayer,
      storage: InjectedStorageInterface,
      publicClient: PublicClient,
      callbacks?: ShielderCallbacks,
    ) =>
      new ShielderClient(
        shielderSeedPrivateKey,
        contract,
        relayer,
        storage,
        publicClient,
        callbacks,
      );
    // Expose shielder actions
    window.shielder.actions = window.shielder.actions || {};
    window.shielder.actions.createNewAccountAction = (contract: Contract) =>
      new NewAccountAction(contract);
    window.shielder.actions.createDepositAction = (contract: Contract) =>
      new DepositAction(contract);
    window.shielder.actions.createWithdrawAction = (
      contract: Contract,
      relayer: Relayer,
    ) => new WithdrawAction(contract, relayer);
    window.shielder.testUtils = window.shielder.testUtils || {};
    window.shielder.testUtils.mockedServices = mockedServices;
    // Expose storage utilities
    window.storage = window.storage || {};
    window.storage.mockedStorage = mockedStorage;
  }, []);

  return null;
}

export default EntryPoint;

namespace wasmModuleImpl {
  export async function init(): Promise<number> {
    const threads = navigatorHardwareConcurrencyOrThreadsOverrideFromEnv();
    if (threads === 1) {
      await singlethreaded_wasm.default();
      console.log(`singlethreaded_wasm initialized`);
    } else {
      await multithreaded_wasm.default();
      await multithreaded_wasm.initThreadPool(threads);
      console.log(`multithreaded_wasm initialized with ${threads} threads`);
    }
    return threads;
  }
}

namespace wasmClientWorkerImpl {
  // Returns the number of threads used by `WasmClientWorker`.
  export async function isReady(): Promise<number> {
    await wasmClientWorkerInit(
      navigatorHardwareConcurrencyOrThreadsOverrideFromEnv(),
    );
    const threads = await wasmClientWorker.threads;
    return threads!;
  }
}
