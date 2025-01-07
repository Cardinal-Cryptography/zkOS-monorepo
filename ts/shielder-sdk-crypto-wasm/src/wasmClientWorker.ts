import { expose } from "comlink";
import { WasmClient, Caller } from "./wasmClient";
import { CryptoClient } from "shielder-sdk-crypto";

class WasmClientWorkerImpl extends WasmClient {
  async init(caller: Caller, threads: number): Promise<void> {
    if (threads < 1) {
      throw new Error("Invalid number of threads");
    }
    await super.init(caller, threads);
  }
}

// Create and expose the worker instance
const wasmClientWorker = new WasmClientWorkerImpl();
expose(wasmClientWorker);

// Export type for the main thread
export type WasmClientWorker = WasmClientWorkerImpl;

// Helper function for initializing the worker from the main thread
export const initWasmWorker = async (
  threads: number
): Promise<CryptoClient> => {
  const worker = new Worker(new URL("./wasmClientWorker", import.meta.url), {
    type: "module"
  });
  const { wrap } = await import("comlink");
  const wrappedWorker = wrap<WasmClientWorker>(worker);

  try {
    const caller = threads === 1 ? "web_singlethreaded" : "web_multithreaded";
    await wrappedWorker.init(caller, threads);
    return wrappedWorker;
  } catch (error) {
    console.error("Failed to initialize WASM worker:", error);
    worker.terminate();
    throw error;
  }
};
