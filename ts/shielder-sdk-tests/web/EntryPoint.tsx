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
import { initWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm";
import { envThreadsNumber } from "./testUtils";
import type { GlobalConfigFixture } from "@tests/playwrightFixtures/globalConfig";
import {
  type ShielderTestFixture,
  setupShielderTest
} from "./fixtures/shielderTest/setup";

import newAccountParamsUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/new_account/params.bin?url";
import newAccountPkUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/new_account/pk.bin?url";
import depositParamsUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/deposit/params.bin?url";
import depositPkUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/deposit/pk.bin?url";
import withdrawParamsUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/withdraw/params.bin?url";
import withdrawPkUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/withdraw/pk.bin?url";

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

async function fetchArrayBuffer(url: string): Promise<Uint8Array> {
  return await fetch(url).then((r) => r.bytes());
}

function EntryPoint() {
  useEffect(() => {
    const initialize = async () => {
      const newAccountParams = await fetchArrayBuffer(newAccountParamsUrl);
      const newAccountPk = await fetchArrayBuffer(newAccountPkUrl);
      const depositParams = await fetchArrayBuffer(depositParamsUrl);
      const depositPk = await fetchArrayBuffer(depositPkUrl);
      const withdrawParams = await fetchArrayBuffer(withdrawParamsUrl);
      const withdrawPk = await fetchArrayBuffer(withdrawPkUrl);
      // test fixtures initialization
      window.testFixtures = window.testFixtures || {};
      window.testFixtures.setupHappyTest = setupShielderTest;
      // Wasm crypto client initialization
      window.wasmCryptoClient = window.wasmCryptoClient || {};
      window.wasmCryptoClient.cryptoClient = initWasmWorker(
        envThreadsNumber(),
        {
          paramsBuf: newAccountParams,
          pkBuf: newAccountPk
        },
        {
          paramsBuf: depositParams,
          pkBuf: depositPk
        },
        {
          paramsBuf: withdrawParams,
          pkBuf: withdrawPk
        }
      );
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
