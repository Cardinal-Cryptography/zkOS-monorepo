import { verifyAttestation } from "@/nitro-attestation";
import * as secp from "@noble/secp256k1";

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
      method: "GET",
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
}
