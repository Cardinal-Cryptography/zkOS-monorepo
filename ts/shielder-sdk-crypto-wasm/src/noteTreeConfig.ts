import { Caller } from "./wasmClient";
import { WasmModuleBase } from "./utils/wasmModuleLoader";
import { NoteTreeConfig as INoteTreeConfig } from "shielder-sdk-crypto";

export class NoteTreeConfig extends WasmModuleBase implements INoteTreeConfig {
  init(caller: Caller) {
    super.init(caller);
  }

  treeHeight(): Promise<number> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(this.wasmModule.tree_height());
  }

  async arity(): Promise<number> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(this.wasmModule.arity());
  }
}

/**
 * Objects of this type are passed through `wrap` from `comlink`.
 * As long as they don't have methods, it works.
 */
