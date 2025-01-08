import { Scalar } from "shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmModuleBase } from "./utils/wasmModuleLoader";
import { Hex } from "viem";
import { Converter as IConverter } from "shielder-sdk-crypto";

export class Converter extends WasmModuleBase implements IConverter {
  init(caller: Caller) {
    super.init(caller);
  }

  privateKeyToScalar(hex: Hex): Promise<Scalar> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(new Scalar(this.wasmModule.private_key_to_f(hex)));
  }
}
