import { Scalar } from "@/crypto/scalar";
import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";
import { Caller } from "@/wasmClient";

type WasmModule = typeof singleThreadedWasm | typeof multiThreadedWasm;

export class SecretGenerator {
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

  getSecrets(id: Scalar, nonce: bigint): ShielderActionSecrets {
    const result = this.wasmModule.get_action_secrets(id.bytes, Number(nonce));
    return {
      nullifier: new Scalar(result.nullifier),
      trapdoor: new Scalar(result.trapdoor)
    };
  }
}

/**
 * Objects of this type are passed through `wrap` from `comlink`.
 * As long as they don't have methods, it works.
 */
export type ShielderActionSecrets = {
  nullifier: Scalar;
  trapdoor: Scalar;
};
