import { Scalar } from "shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";
import { flatUint8 } from "./utils";
import { Hasher as IHasher } from "shielder-sdk-crypto";

export class Hasher extends WasmClientModuleBase implements IHasher {
  init(caller: Caller) {
    super.init(caller);
  }

  poseidonHash(input: Scalar[]): Promise<Scalar> {
    console.log("Hasher.poseidonHash", input, this.caller, this.wasmModule);
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    if (input.length == 0) {
      throw new Error("Empty input");
    }
    if (input.length > this.wasmModule.arity()) {
      throw new Error("Input too large");
    }
    return Promise.resolve(
      new Scalar(
        this.wasmModule.poseidon_hash(flatUint8(input.map((s) => s.bytes)))
      )
    );
  }

  poseidonRate(): Promise<number> {
    // TODO: implement when wasm module has this function
    throw new Error("Method not implemented.");
  }
}
