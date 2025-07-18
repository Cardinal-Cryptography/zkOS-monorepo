import newAccountParamsUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/new_account/params.bin?url";
import newAccountPkUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/new_account/pk.bin?url";
import depositParamsUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/deposit/params.bin?url";
import depositPkUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/deposit/pk.bin?url";
import withdrawParamsUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/withdraw/params.bin?url";
import withdrawPkUrl from "@cardinal-cryptography/shielder-sdk-crypto-wasm/keys/withdraw/pk.bin?url";

import { initWasmWorker as initFullWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm";

import { initWasmWorker as initLightWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm-light";

async function fetchArrayBuffer(url: string): Promise<Uint8Array> {
  return await fetch(url).then((r) => r.bytes());
}

export async function initFullWasm() {
  const newAccountParams = await fetchArrayBuffer(newAccountParamsUrl);
  const newAccountPk = await fetchArrayBuffer(newAccountPkUrl);
  const depositParams = await fetchArrayBuffer(depositParamsUrl);
  const depositPk = await fetchArrayBuffer(depositPkUrl);
  const withdrawParams = await fetchArrayBuffer(withdrawParamsUrl);
  const withdrawPk = await fetchArrayBuffer(withdrawPkUrl);
  console.log("Full Wasm crypto client initialized with params and keys");
  return initFullWasmWorker(
    "multi",
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
}

export async function initLightWasm(
  proverServerUrl: string,
  withoutAttestation: boolean
) {
  return initLightWasmWorker(proverServerUrl, withoutAttestation);
}
