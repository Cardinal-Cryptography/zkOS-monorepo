import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";
import { Caller } from "../wasmClient";

export type WasmModule = typeof singleThreadedWasm | typeof multiThreadedWasm;

const wasmModules = {
  web_singlethreaded: singleThreadedWasm,
  web_multithreaded: multiThreadedWasm
} as const;

export function getWasmModule(caller: Caller): WasmModule {
  const module = wasmModules[caller];
  if (!module) {
    throw new Error("Invalid caller");
  }
  return module;
}

export abstract class WasmClientModuleBase {
  protected caller: Caller | undefined;
  protected wasmModule: WasmModule | undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  init(caller: Caller, ...args: any[]) {
    this.caller = caller;
    this.wasmModule = getWasmModule(caller);
  }
}

export abstract class CircuitBase<T> extends WasmClientModuleBase {
  protected wasmCircuit: T | undefined;

  init(caller: Caller, createCircuit: (module: WasmModule) => T) {
    super.init(caller);
    const wasmModule = getWasmModule(caller);
    this.wasmCircuit = createCircuit(wasmModule);
  }
}
