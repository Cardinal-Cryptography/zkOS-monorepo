import * as singleThreadedWasm from "shielder_bindings/web-singlethreaded";
import * as multiThreadedWasm from "shielder_bindings/web-multithreaded";
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  init(caller: Caller, ...args: unknown[]) {
    this.caller = caller;
    this.wasmModule = getWasmModule(caller);
  }
}
