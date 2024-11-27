import { Scalar } from "@/crypto/scalar";
import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";
import { Caller } from "@/wasmClient";
import { Hex } from "viem";

type WasmModule = typeof singleThreadedWasm | typeof multiThreadedWasm;

export class Converter {
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

  privateKeyToScalar(hex: Hex): Scalar {
    return new Scalar(this.wasmModule.private_key_to_f(hex));
  }
}
