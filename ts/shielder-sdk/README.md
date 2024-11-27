# `shielder-sdk`

A web package for interacting with Shielder, a part of zkOS privacy engine.

## Usage

In order to use most of the modules, WASM needs to be loaded. This package starts loading WASM automatically. User should await the published promise `wasmClientWorkerReady()`.

### Example usage

```
import {wasmClientWorkerInit, ShielderClient} from "@cardinal-cryptography/shielder-sdk"

const threads = navigator.hardwareConcurrency;

await wasmClientWorkerInit(threads).then(async () => {
    // WASM initialization complete, ready to use sdk

    const shielderClient = ShielderClient.create(
        ...
        // parameters go there
    );
    await shielderClient.shield(1n);
})


```

## Development & Contribution

If you want to work with local build of `shielder-wasm` package, link the local dependency in `package.json`:

```
"shielder-wasm": "link:../../crates/shielder-wasm/pkg",
```

and do `pnpm update`
