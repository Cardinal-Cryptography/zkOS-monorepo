import { expose, wrap } from "comlink";
import { WasmClient } from "./wasmClient";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";

// Create worker instance
const wasmClientWorker = new WasmClient();

// This proxy intercepts property access (like hasher, converter) on the worker.
// When the main thread calls hasher.poseidonHash(), two things happen:
// 1. Our proxy returns the hasher object directly from the worker
// 2. Comlink then wraps hasher's methods for cross-thread communication
// This way, only method calls are transferred between threads, not entire objects.
const exposed = new Proxy(wasmClientWorker, {
  get(target, prop: string | symbol) {
    // Handle init method separately since it's on the worker itself
    if (prop === "init") {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      return target.init;
    }

    // For module properties (hasher, converter, etc.),
    // return the actual module instance.
    // Comlink will automatically wrap its methods for worker communication.
    if (typeof prop === "string" && prop in wasmClientWorker) {
      return wasmClientWorker[prop as keyof WasmClient];
    }

    throw new Error(`Method ${String(prop)} not found`);
  }
});

// Make the proxied worker available to the main thread
expose(exposed);

/**
 * Creates and initializes a worker from the main thread.
 * Returns a Comlink-wrapped worker that implements CryptoClient.
 * Pass `wasm_url` only if you need the special setup (such as vite-patched distribution).
 *
 * @param threads - The number of threads to use (1 for single-threaded, >1 for multi-threaded).
 * @param new_account_params_buf - Uint8Array containing the new account params binary data
 * @param new_account_pk_buf - Uint8Array containing the new account pk binary data
 * @param deposit_params_buf - Uint8Array containing the deposit params binary data
 * @param deposit_pk_buf - Uint8Array containing the deposit pk binary data
 * @param withdraw_params_buf - Uint8Array containing the withdraw params binary data
 * @param withdraw_pk_buf - Uint8Array containing the withdraw pk binary data
 * @param wasm_url - Optional URL to the WASM binary.
 * @returns A promise that resolves to a Comlink-wrapped worker implementing CryptoClient.
 * @throws Will throw an error if the worker initialization fails.
 */
export const initWasmWorker = async (
  threads: number,
  new_account_params_buf: Uint8Array,
  new_account_pk_buf: Uint8Array,
  deposit_params_buf: Uint8Array,
  deposit_pk_buf: Uint8Array,
  withdraw_params_buf: Uint8Array,
  withdraw_pk_buf: Uint8Array,
  wasm_url?: string
): Promise<CryptoClient> => {
  // Create a new worker instance
  const worker = new Worker(new URL("./wasmClientWorker", import.meta.url), {
    type: "module"
  });

  // Wrap the worker with Comlink to enable cross-thread method calls
  // Because of the previous construction, wrapper worker is
  // not of type Remote<WasmClient> but of type WasmClient
  // @ts-ignore: wrap<WasmClient> is not compatible with WasmClient
  const wrappedWorker = wrap<WasmClient>(worker) as unknown as WasmClient;

  try {
    // Initialize with single or multi-threaded mode
    const caller = threads === 1 ? "web_singlethreaded" : "web_multithreaded";
    await wrappedWorker.init(
      caller,
      threads,
      new_account_params_buf,
      new_account_pk_buf,
      deposit_params_buf,
      deposit_pk_buf,
      withdraw_params_buf,
      withdraw_pk_buf,
      wasm_url
    );
    return wrappedWorker;
  } catch (error) {
    console.error("Failed to initialize WASM worker:", error);
    worker.terminate();
    throw error;
  }
};
