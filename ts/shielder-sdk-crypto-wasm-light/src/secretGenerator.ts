import {
  Scalar,
  ShielderActionSecrets,
  SecretManager as ISecretManager
} from "@cardinal-cryptography/shielder-sdk-crypto";
import * as singleThreadedWasm from "shielder_bindings/web-singlethreaded";

export class SecretGenerator implements ISecretManager {
  getSecrets(
    id: Scalar,
    nonce: number
  ): Promise<ShielderActionSecrets<Scalar>> {
    const result = singleThreadedWasm.get_action_secrets(
      id.bytes,
      Number(nonce)
    );
    return Promise.resolve({
      nullifier: new Scalar(result.nullifier)
    });
  }

  deriveId(
    privateKey: `0x${string}`,
    chainId: bigint,
    accountNonce: number
  ): Promise<Scalar> {
    const result = singleThreadedWasm.derive_id(
      privateKey,
      chainId,
      accountNonce
    );
    return Promise.resolve(new Scalar(result));
  }
}
