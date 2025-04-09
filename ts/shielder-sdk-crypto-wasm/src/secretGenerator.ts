import {
  Scalar,
  ShielderActionSecrets,
  SecretManager as ISecretManager
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "./wasmClient";
import { WasmClientModuleBase } from "./utils/wasmModuleLoader";

export class SecretGenerator
  extends WasmClientModuleBase
  implements ISecretManager
{
  init(caller: Caller) {
    super.init(caller);
  }

  getSecrets(
    id: Scalar,
    nonce: number
  ): Promise<ShielderActionSecrets<Scalar>> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    const result = this.wasmModule.get_action_secrets(id.bytes, Number(nonce));
    return Promise.resolve({
      nullifier: new Scalar(result.nullifier)
    });
  }

  deriveId(
    privateKey: `0x${string}`,
    chainId: bigint,
    accountNonce: number
  ): Promise<Scalar> {
    if (!this.wasmModule) {
      throw new Error("Wasm module not initialized");
    }
    const result = this.wasmModule.derive_id(privateKey, chainId, accountNonce);
    return Promise.resolve(new Scalar(result));
  }
}
