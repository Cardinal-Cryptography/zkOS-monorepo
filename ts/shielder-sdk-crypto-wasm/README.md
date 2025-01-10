# shielder-sdk-crypto-wasm

WASM implementation of cryptographic operations for the Shielder SDK.

## Usage

### Basic Usage

```typescript
import { initWasmWorker } from "shielder-sdk-crypto-wasm";

// Initialize with number of threads
const wasmWorker = await initWasmWorker(4);

// Use the worker
const input = Array(1).fill(Scalar.fromBigint(32n));
const hash = await wasmWorker.hasher.poseidonHash(input);
```

### Usage with Vite

When using Vite, you might have problems with bundler:

- not including wasm file in the `/asset` directory
- not including WebWorker code in the final bundle
  If you have such problem, you need to:

1. Import from the Vite-specific entrypoint
2. Import target WASM file with `?url` suffix. Note, that you manually choose single-threaded or multi-threaded version
3. Initialize with thread count and WASM file url

```typescript
import { initWasmWorker } from "shielder-sdk-crypto-wasm/vite";
import shielderWasmUrl from "shielder-sdk-crypto-wasm/multithreaded_wasm?url";

const wasmWorker = await initWasmWorker(4, shielderWasmUrl);
```

## Package Exports

The package provides several entrypoints:

```json
{
  "exports": {
    ".": "./dist/index.js", // Default entrypoint
    "./vite": "./dist-vite/index.js", // Vite-specific entrypoint
    "./singlethreaded_wasm": "...", // Single-threaded WASM
    "./multithreaded_wasm": "..." // Multi-threaded WASM
  }
}
```

### Vite Patch

The package includes a patch for Vite that handles Web Worker initialization properly. The patch:

1. Creates a Vite-specific distribution
2. Modifies worker initialization code
3. Adds inline worker imports

## API

### initWasmWorker

```typescript
function initWasmWorker(
  threads: number,
  wasmUrl?: string
): Promise<CryptoClient>;
```

Parameters:

- `threads`: Number of threads to use for WASM operations
- `wasmUrl`: (Optional) URL to WASM file, specify ONLY when using Vite

Returns:

- Promise that resolves to a `CryptoClient` instance from the package `shielder-sdk-crypto`
