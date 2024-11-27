// This file is a wrapper around the worker to make it easier to use in the main thread

import { wrap } from "comlink";

import type { WasmClientWorker } from "./wasmClientWorkerDeclare";

const workerUnready = new Worker(
  new URL("./wasmClientWorkerDeclare", import.meta.url),
  {
    name: "wasmClientWorkerDeclare",
    type: "module"
  }
);
export const wasmClientWorker = wrap<WasmClientWorker>(workerUnready);

// Call once for WASM initialization
export const wasmClientWorkerInit = async (threads: number) => {
  return wasmClientWorker.init(threads).catch((err) => {
    console.error("Failed to initialize WASM:", err);
    throw err; // Re-throw to handle in the component
  });
};
