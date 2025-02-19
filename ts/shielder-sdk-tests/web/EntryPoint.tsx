import { useEffect } from "react";
import {
  nativeToken,
  createShielderClient,
  InjectedStorageInterface,
  NativeToken,
  ShielderCallbacks,
  ShielderClient,
  ShielderTransaction
} from "@cardinal-cryptography/shielder-sdk";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { initWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm";
import { envThreadsNumber } from "./testUtils";
import {
  ShielderClientFixture,
  setupShielderClient
} from "./fixtures/setupShielderClient";
import { validateTxHistory } from "./validators/txHistory";
import { AccountNames, AccountValue, TestDescription } from "@tests/types";

declare global {
  interface Window {
    wasmCryptoClient: {
      cryptoClient: Promise<CryptoClient>;
    };

    testFixtures: {
      setupShielderClient: (
        chainConfig: {
          chainId: number;
          rpcHttpEndpoint: string;
          contractAddress: `0x${string}`;
          testnetPrivateKey: `0x${string}`;
        },
        relayerConfig: {
          url: string;
        },
        privateKey: `0x${string}`,
        shielderKey: `0x${string}`
      ) => Promise<ShielderClientFixture>;
    };

    validators: {
      validateTxHistory: (
        txHistory: ShielderTransaction[],
        actions: TestDescription["actions"],
        webSdk: AccountValue<ShielderClientFixture>,
        actor: AccountNames
      ) => boolean;
    };

    shielder: {
      createShielderClient: (
        shielderSeedPrivateKey: `0x${string}`,
        chainId: number,
        rpcHttpEndpoint: string,
        contractAddress: `0x${string}`,
        relayerUrl: string,
        storage: InjectedStorageInterface,
        cryptoClient: CryptoClient,
        callbacks?: ShielderCallbacks
      ) => ShielderClient;
      nativeToken: () => NativeToken;
    };

    initialized: boolean;
  }
}

function EntryPoint() {
  useEffect(() => {
    // test fixtures initialization
    window.testFixtures = window.testFixtures || {};
    window.testFixtures.setupShielderClient = setupShielderClient;
    // validators initialization
    window.validators = window.validators || {};
    window.validators.validateTxHistory = validateTxHistory;
    // Wasm crypto client initialization
    window.wasmCryptoClient = window.wasmCryptoClient || {};
    window.wasmCryptoClient.cryptoClient = initWasmWorker(envThreadsNumber());
    // Expose shielder utilities
    window.shielder = window.shielder || {};
    window.shielder.createShielderClient = createShielderClient;
    window.shielder.nativeToken = nativeToken;
    window.initialized = true;
  }, []);

  return null;
}

export default EntryPoint;
