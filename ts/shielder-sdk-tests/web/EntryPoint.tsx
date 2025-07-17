import { useEffect } from "react";
import {
  nativeToken,
  createShielderClient,
  type NativeToken,
  type ShielderClient,
  type ERC20Token,
  erc20Token,
  type ShielderClientConfig
} from "@cardinal-cryptography/shielder-sdk";
import type { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import type { GlobalConfigFixture } from "@tests/playwrightFixtures/globalConfig";
import {
  type ShielderTestFixture,
  setupShielderTest
} from "./fixtures/shielderTest/setup";
import { initFullWasm, initLightWasm } from "./cryptoClient";
import {
  checkNitroAttestation,
  cryptoClientType,
  proverServerUrl
} from "./envConfig";

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
      createShielderClient: (config: ShielderClientConfig) => ShielderClient;
      nativeToken: () => NativeToken;
      erc20Token: (address: `0x${string}`) => ERC20Token;
    };

    initialized: boolean;
  }
}

function EntryPoint() {
  useEffect(() => {
    const initialize = () => {
      // test fixtures initialization
      window.testFixtures = window.testFixtures || {};
      window.testFixtures.setupHappyTest = setupShielderTest;
      // Wasm crypto client initialization
      window.wasmCryptoClient = window.wasmCryptoClient || {};
      console.log("Initializing crypto client with type:", cryptoClientType);
      window.wasmCryptoClient.cryptoClient =
        cryptoClientType === "wasm-full"
          ? initFullWasm()
          : initLightWasm(proverServerUrl, checkNitroAttestation);
      // Expose shielder utilities
      window.shielder = window.shielder || {};
      window.shielder.createShielderClient = createShielderClient;
      window.shielder.nativeToken = nativeToken;
      window.shielder.erc20Token = erc20Token;
      window.initialized = true;
    };
    void initialize();
  }, []);

  return null;
}

export default EntryPoint;
