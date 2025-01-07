import { Scalar } from "shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmModuleBase } from "./utils/wasmModuleLoader";
import { Hex } from "viem";

export class Converter extends WasmModuleBase {
  constructor(caller: Caller) {
    super(caller);
  }

  privateKeyToScalar(hex: Hex): Scalar {
    return new Scalar(this.wasmModule.private_key_to_f(hex));
  }
}
