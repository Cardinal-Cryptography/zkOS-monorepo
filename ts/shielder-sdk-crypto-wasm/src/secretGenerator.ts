import { Scalar, ShielderActionSecrets } from "shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmModuleBase } from "./utils/wasmModuleLoader";

export class SecretGenerator extends WasmModuleBase {
  constructor(caller: Caller) {
    super(caller);
  }

  getSecrets(id: Scalar, nonce: number): ShielderActionSecrets {
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
