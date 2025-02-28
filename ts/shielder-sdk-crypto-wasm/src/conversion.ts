import {
  Scalar,
  Converter as IConverter
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";

export class Converter extends WasmClientModuleBase implements IConverter {
  init(caller: Caller) {
    super.init(caller);
  }

  hex32ToScalar(hex: `0x${string}`): Promise<Scalar> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    return Promise.resolve(new Scalar(this.wasmModule.hex_32_to_f(hex)));
  }
}
