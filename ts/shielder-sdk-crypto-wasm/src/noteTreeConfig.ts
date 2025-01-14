import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";
import { NoteTreeConfig as INoteTreeConfig } from "@cardinal-cryptography/shielder-sdk-crypto";

export class NoteTreeConfig
  extends WasmClientModuleBase
  implements INoteTreeConfig
{
  init(caller: Caller) {
    super.init(caller);
  }

  treeHeight(): Promise<number> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(this.wasmModule.note_tree_height());
  }

  async arity(): Promise<number> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(this.wasmModule.note_arity());
  }
}
