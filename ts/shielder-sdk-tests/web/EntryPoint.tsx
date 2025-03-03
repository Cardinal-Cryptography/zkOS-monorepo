import { useEffect } from "react";
import {
  nativeToken,
  createShielderClient,
  type InjectedStorageInterface,
  type NativeToken,
  type ShielderCallbacks,
  type ShielderClient,
  type ERC20Token,
  erc20Token
} from "@cardinal-cryptography/shielder-sdk";
import type { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { initWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm";
import { envThreadsNumber } from "./testUtils";
import type { GlobalConfigFixture } from "@tests/playwrightFixtures/globalConfig";
import {
  type ShielderTestFixture,
  setupShielderTest
} from "./fixtures/shielderTest/setup";
import type { PublicClient } from "viem";

declare global {
  interface Window {
    wasmCryptoClient: {
      cryptoClient: Promise<CryptoClient>;
    };

    testFixtures: {
      setupHappyTest: (
        globalConfig: GlobalConfigFixture
      ) => Promise<ShielderTestFixture>;
    };

    shielder: {
      createShielderClient: (
        shielderSeedPrivateKey: `0x${string}`,
        chainId: number,
        publicClient: PublicClient,
        contractAddress: `0x${string}`,
        relayerUrl: string,
        storage: InjectedStorageInterface,
        cryptoClient: CryptoClient,
        callbacks?: ShielderCallbacks
      ) => ShielderClient;
      nativeToken: () => NativeToken;
      erc20Token: (address: `0x${string}`) => ERC20Token;
    };

    initialized: boolean;
  }
}

function EntryPoint() {
  useEffect(() => {
    // test fixtures initialization
    window.testFixtures = window.testFixtures || {};
    window.testFixtures.setupHappyTest = setupShielderTest;
    // Wasm crypto client initialization
    window.wasmCryptoClient = window.wasmCryptoClient || {};
    window.wasmCryptoClient.cryptoClient = initWasmWorker(envThreadsNumber());
    // Expose shielder utilities
    window.shielder = window.shielder || {};
    window.shielder.createShielderClient = createShielderClient;
    window.shielder.nativeToken = nativeToken;
    window.shielder.erc20Token = erc20Token;
    window.initialized = true;
  }, []);

  return null;
}

export default EntryPoint;
