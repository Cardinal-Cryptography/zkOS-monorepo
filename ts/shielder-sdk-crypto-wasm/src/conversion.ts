import {
  Scalar,
  Converter as IConverter
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";
import { Hex } from "viem";

export class Converter extends WasmClientModuleBase implements IConverter {
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
