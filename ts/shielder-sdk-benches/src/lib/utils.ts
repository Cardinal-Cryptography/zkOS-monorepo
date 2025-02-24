import { initWasmWorker } from "@cardinal-cryptography/shielder-sdk-crypto-wasm";

// random seed
export const idSeed =
  "0xa17752eeed11a888231f31a544fbe2437357a50c1b0b5d2be9792545072193be";

export const wasmCryptoClientRead = initWasmWorker(
  navigator.hardwareConcurrency
);
