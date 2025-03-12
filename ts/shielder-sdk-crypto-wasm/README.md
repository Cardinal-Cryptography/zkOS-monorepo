# `shielder-sdk-crypto-wasm`

WASM implementation of cryptographic operations for the Shielder SDK.

## Usage

### Basic Usage

```typescript
import { initWasmWorker } from "shielder-sdk-crypto-wasm";

// import file urls with your bundler syntax. This is Vite example.
import newAccountParamsUrl from "shielder-sdk-crypto-wasm/keys/new_account/params.bin?url";
import newAccountPkUrl from "shielder-sdk-crypto-wasm/keys/new_account/pk.bin?url";
import depositParamsUrl from "shielder-sdk-crypto-wasm/keys/deposit/params.bin?url";
import depositPkUrl from "shielder-sdk-crypto-wasm/keys/deposit/pk.bin?url";
import withdrawParamsUrl from "shielder-sdk-crypto-wasm/keys/withdraw/params.bin?url";
import withdrawPkUrl from "shielder-sdk-crypto-wasm/keys/withdraw/pk.bin?url";

// Fetch the required circuit parameters and proving keys
const newAccountParams = await fetch(newAccountParamsUrl).then((r) =>
  r.bytes()
);
const newAccountPk = await fetch(newAccountPkUrl).then((r) => r.bytes());
const depositParams = await fetch(depositParamsUrl).then((r) => r.bytes());
const depositPk = await fetch(depositPkUrl).then((r) => r.bytes());
const withdrawParams = await fetch(withdrawParamsUrl).then((r) => r.bytes());
const withdrawPk = await fetch(withdrawPkUrl).then((r) => r.bytes());

// Initialize with number of threads and circuit parameters
const wasmWorker = await initWasmWorker(
  4,
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

// Use the worker
const input = Array(1).fill(Scalar.fromBigint(32n));
const hash = await wasmWorker.hasher.poseidonHash(input);
```

### Problems with advanced Vite bundling

When using Vite in advanced configurations (like library mode), you might have problems with bundler:

- not including wasm file in the `/asset` directory
- not including WebWorker code in the final bundle
  If you have such problem, you need to:

1. Import from the Vite-specific entrypoint
2. Import target WASM file with `?url` suffix. Note, that you manually choose single-threaded or multi-threaded version
3. Import circuit parameters and proving keys with `?url` suffix
4. Initialize with thread count, circuit parameters, and WASM file url

```typescript
import { initWasmWorker } from "shielder-sdk-crypto-wasm/vite";
import shielderWasmUrl from "shielder-sdk-crypto-wasm/multithreaded_wasm?url";
import newAccountParamsUrl from "shielder-sdk-crypto-wasm/keys/new_account/params.bin?url";
import newAccountPkUrl from "shielder-sdk-crypto-wasm/keys/new_account/pk.bin?url";
import depositParamsUrl from "shielder-sdk-crypto-wasm/keys/deposit/params.bin?url";
import depositPkUrl from "shielder-sdk-crypto-wasm/keys/deposit/pk.bin?url";
import withdrawParamsUrl from "shielder-sdk-crypto-wasm/keys/withdraw/params.bin?url";
import withdrawPkUrl from "shielder-sdk-crypto-wasm/keys/withdraw/pk.bin?url";

// Fetch the required circuit parameters and proving keys
const newAccountParams = await fetch(newAccountParamsUrl).then((r) =>
  r.bytes()
);
const newAccountPk = await fetch(newAccountPkUrl).then((r) => r.bytes());
const depositParams = await fetch(depositParamsUrl).then((r) => r.bytes());
const depositPk = await fetch(depositPkUrl).then((r) => r.bytes());
const withdrawParams = await fetch(withdrawParamsUrl).then((r) => r.bytes());
const withdrawPk = await fetch(withdrawPkUrl).then((r) => r.bytes());

const wasmWorker = await initWasmWorker(
  4,
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
  },
  shielderWasmUrl
);
```

## Package Exports

The package provides several entrypoints:

```json
{
  "exports": {
    ".": "./dist/index.js", // Default entrypoint
    "./vite": "./dist-vite/index.js", // Vite-patched entrypoint
    "./singlethreaded_wasm": "...", // Single-threaded WASM
    "./multithreaded_wasm": "...", // Multi-threaded WASM
    "./keys/*": "./dist-keys/*" // Circuit parameters and proving keys
  }
}
```

## API

### initWasmWorker

```typescript
function initWasmWorker(
  threads: number,
  newAccountBuf: CircuitParamsPkBuffer,
  depositBuf: CircuitParamsPkBuffer,
  withdrawBuf: CircuitParamsPkBuffer,
  wasmUrl?: string
): Promise<CryptoClient>;
```

Parameters:

- `threads`: Number of threads to use for WASM operations
- `newAccountBuf`: Circuit parameters and proving key for new account operations
- `depositBuf`: Circuit parameters and proving key for deposit operations
- `withdrawBuf`: Circuit parameters and proving key for withdraw operations
- `wasmUrl`: (Optional) URL to WASM file, specify ONLY when using Vite

The `CircuitParamsPkBuffer` type is defined as:

```typescript
type CircuitParamsPkBuffer = {
  paramsBuf: Uint8Array;
  pkBuf: Uint8Array;
};
```

Returns:

- Promise that resolves to a `CryptoClient` instance from the package `shielder-sdk-crypto`

### Circuit Parameters and Proving Keys

The package exports circuit parameters and proving keys that are required for cryptographic operations:

- `/keys/new_account/params.bin`: Parameters for new account operations
- `/keys/new_account/pk.bin`: Proving key for new account operations
- `/keys/deposit/params.bin`: Parameters for deposit operations
- `/keys/deposit/pk.bin`: Proving key for deposit operations
- `/keys/withdraw/params.bin`: Parameters for withdraw operations
- `/keys/withdraw/pk.bin`: Proving key for withdraw operations

These files can be imported with the `?url` suffix when using bundlers like Vite:

```typescript
import newAccountParamsUrl from "shielder-sdk-crypto-wasm/keys/new_account/params.bin?url";
```
