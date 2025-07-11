import {
  base64ToBytes,
  bytesToBase64,
  uint8ToHex,
  verifyAttestation
} from "@/nitro-attestation";
import * as secp from "@noble/secp256k1";
import { decrypt, encrypt, generateKeypair } from "./crypto";
import { objectToBytes } from "@/utils";

type TeePublicKeyResponse = {
  // secp256k1 public key in hex format
  public_key: string;
  // base64-encoded AWS Nitro attestation document
  attestation_document: string;
};

export class TeeClient {
  provingServiceUrl: string | undefined;

  provingServicePublicKey: secp.Point | undefined;

  async init(
    provingServiceUrl: string,
    withoutAttestation: boolean
  ): Promise<void> {
    this.provingServiceUrl = provingServiceUrl;

    const response = await fetch(`${this.provingServiceUrl}/public_key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch public key from TEE service: ${response.statusText}`
      );
    }
    const data: TeePublicKeyResponse =
      (await response.json()) as TeePublicKeyResponse;
    if (!data.public_key || !data.attestation_document) {
      throw new Error(
        "Invalid response from TEE service: missing public key or attestation document"
      );
    }

    if (withoutAttestation) {
      this.provingServicePublicKey = secp.Point.fromHex(data.public_key);
      return;
    }

    await verifyAttestation(data.attestation_document);

    this.provingServicePublicKey = secp.Point.fromHex(data.public_key);
  }

  async prove(
    circuitType: number,
    witness: Uint8Array
  ): Promise<{
    proof: Uint8Array;
    pubInputs: Uint8Array;
  }> {
    if (!this.provingServiceUrl || !this.provingServicePublicKey) {
      throw new Error(
        "TeeClient is not initialized. Call init() before proving."
      );
    }

    const { sk, pk } = generateKeypair();

    const payload = objectToBytes({
      circuit_type: circuitType,
      circuit_inputs: witness,
      user_public_key: uint8ToHex(pk)
    });

    const base64Payload = bytesToBase64(payload);

    const base64PayloadEncrypted = await encrypt(
      base64Payload,
      uint8ToHex(this.provingServicePublicKey.toRawBytes(true))
    ).catch((e) => {
      throw new Error(`Failed to encrypt payload: ${e}`);
    });

    const response = await fetch(`${this.provingServiceUrl}/prove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payload: base64PayloadEncrypted
      })
    });

    if (!response.ok) {
      throw new Error(
        `Failed to prove with TEE service: ${response.statusText}`
      );
    }
    const data = (await response.json()) as {
      proof: string;
      pub_inputs: string;
    };

    if (!data.proof || !data.pub_inputs) {
      throw new Error(
        "Invalid response from TEE service: missing proof or public inputs"
      );
    }

    return {
      proof: base64ToBytes(await decrypt(data.proof, uint8ToHex(sk))),
      pubInputs: base64ToBytes(await decrypt(data.pub_inputs, uint8ToHex(sk)))
    };
  }
}
