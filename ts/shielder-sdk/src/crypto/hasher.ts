import { Scalar } from "@/crypto/scalar";
import { flatUint8 } from "@/utils";
import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";
import { Caller } from "@/wasmClient";

type WasmModule = typeof singleThreadedWasm | typeof multiThreadedWasm;

export class Hasher {
  caller: Caller;
  wasmModule: WasmModule;

  constructor(caller: Caller) {
    this.caller = caller;
    if (caller == "web_singlethreaded") {
      this.wasmModule = singleThreadedWasm;
    } else if (caller == "web_multithreaded") {
      this.wasmModule = multiThreadedWasm;
    } else {
      throw new Error("Invalid caller");
    }
  }

  poseidonHash(input: Scalar[]): Scalar {
    if (input.length == 0) {
      throw new Error("Empty input");
    }
    if (input.length > this.wasmModule.arity()) {
      throw new Error("Input too large");
    }
    return new Scalar(
      this.wasmModule.padded_poseidon_hash(flatUint8(input.map((s) => s.bytes)))
    );
  }

  arity(): number {
    return this.wasmModule.arity();
  }

  treeHeight(): number {
    return this.wasmModule.tree_height();
  }
}
