import { Scalar, ShielderActionSecrets } from "shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";
import { SecretManager as ISecretManager } from "shielder-sdk-crypto";

export class SecretGenerator
  extends WasmClientModuleBase
  implements ISecretManager
{
  init(caller: Caller) {
    super.init(caller);
  }

  getSecrets(id: Scalar, nonce: number): Promise<ShielderActionSecrets> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    const result = this.wasmModule.get_action_secrets(id.bytes, Number(nonce));
    return Promise.resolve({
      nullifier: new Scalar(result.nullifier),
      trapdoor: new Scalar(result.trapdoor)
    });
  }
}

/**
 * Objects of this type are passed through `wrap` from `comlink`.
 * As long as they don't have methods, it works.
 */
