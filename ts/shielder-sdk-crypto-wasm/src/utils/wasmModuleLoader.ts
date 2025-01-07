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

export abstract class WasmModuleBase {
  protected caller: Caller;
  protected wasmModule: WasmModule;

  constructor(caller: Caller) {
    this.caller = caller;
    this.wasmModule = getWasmModule(caller);
  }
}

export abstract class CircuitBase<T> {
  protected caller: Caller;
  protected circuit: T;

  constructor(caller: Caller, createCircuit: (module: WasmModule) => T) {
    this.caller = caller;
    const wasmModule = getWasmModule(caller);
    this.circuit = createCircuit(wasmModule);
  }
}
