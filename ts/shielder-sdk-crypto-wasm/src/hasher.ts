import { Scalar } from "shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmModuleBase } from "./utils/wasmModuleLoader";
import { flatUint8 } from "./utils";

export class Hasher extends WasmModuleBase {
  constructor(caller: Caller) {
    super(caller);
  }

  poseidonHash(input: Scalar[]): Scalar {
    if (input.length == 0) {
      throw new Error("Empty input");
    }
    if (input.length > this.wasmModule.arity()) {
      throw new Error("Input too large");
    }
    return new Scalar(
      this.wasmModule.poseidon_hash(flatUint8(input.map((s) => s.bytes)))
    );
  }

  arity(): number {
    return this.wasmModule.arity();
  }

  treeHeight(): number {
    return this.wasmModule.tree_height();
  }
}
