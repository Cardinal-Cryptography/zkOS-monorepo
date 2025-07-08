import { NoteTreeConfig as INoteTreeConfig } from "@cardinal-cryptography/shielder-sdk-crypto";
import * as singleThreadedWasm from "shielder_bindings/web-singlethreaded";

export class NoteTreeConfig implements INoteTreeConfig {
  treeHeight(): Promise<number> {
    return Promise.resolve(singleThreadedWasm.note_tree_height());
  }

  async arity(): Promise<number> {
    return Promise.resolve(singleThreadedWasm.note_tree_arity());
  }
}
