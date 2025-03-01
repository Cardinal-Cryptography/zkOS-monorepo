import {
  Scalar,
  Hasher as IHasher
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";
import { flatUint8 } from "./utils";

export class Hasher extends WasmClientModuleBase implements IHasher {
  init(caller: Caller) {
    super.init(caller);
  }

  poseidonHash(input: Scalar[]): Promise<Scalar> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    if (input.length == 0) {
      throw new Error("Empty input");
    }
    if (input.length > this.wasmModule.poseidon_rate()) {
      throw new Error("Input too large");
    }
    return Promise.resolve(
      new Scalar(
        this.wasmModule.poseidon_hash(flatUint8(input.map((s) => s.bytes)))
      )
    );
  }

  poseidonRate(): Promise<number> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(this.wasmModule.poseidon_rate());
  }
}
