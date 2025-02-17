import { useEffect } from "react";
import {
  createShielderClient,
  InjectedStorageInterface,
  ShielderCallbacks,
  ShielderClient
} from "@cardinal-cryptography/shielder-sdk";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { initWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm";
import { envThreadsNumber } from "./testUtils";
import { mockedStorage } from "./storage";
import { ContractTestFixture, setupContractTest } from "./chain/testUtils";

declare global {
  interface Window {
    wasmCryptoClient: {
      cryptoClient: Promise<CryptoClient>;
    };

    testUtils: {
      setupContractTest: (
        initialPublicBalance: bigint,
        chainConfig: {
          chainId: number;
          rpcHttpEndpoint: string;
          contractAddress: `0x${string}`;
          testnetPrivateKey: `0x${string}`;
        },
        relayerConfig: {
          url: string;
        },
        privateKeyAlice: `0x${string}`
      ) => Promise<ContractTestFixture>;
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
    };
  }
}

function EntryPoint() {
  useEffect(() => {
    // test utils
    window.testUtils = window.testUtils || {};
    window.testUtils.setupContractTest = setupContractTest;
    // Wasm crypto client initialization
    window.wasmCryptoClient = window.wasmCryptoClient || {};
    window.wasmCryptoClient.cryptoClient = initWasmWorker(envThreadsNumber());
    // Expose shielder utilities
    window.shielder = window.shielder || {};
    window.shielder.createShielderClient = createShielderClient;
  }, []);

  return null;
}

export default EntryPoint;
