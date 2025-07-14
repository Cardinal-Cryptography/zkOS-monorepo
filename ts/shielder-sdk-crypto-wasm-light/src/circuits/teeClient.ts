import {
  base64ToBytes,
  bytesToBase64,
  uint8ToHex,
  verifyAttestation
} from "@/nitro-attestation";
import * as secp from "@noble/secp256k1";
import { decrypt, encrypt, generateKeypair } from "./crypto";
import { hexToUint8, objectToBytes } from "@/utils";

type TeePublicKeyResponse = {
  TeePublicKey: {
    // secp256k1 public key in hex format
    public_key: string;
    // base64-encoded AWS Nitro attestation document
    attestation_document: string;
  };
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
    }).catch((e) => {
      throw new Error(`Failed to fetch public key from TEE service: ${e}`);
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch public key from TEE service: ${response.statusText}`
      );
    }
    const data: TeePublicKeyResponse =
      (await response.json()) as TeePublicKeyResponse;
    if (!data.TeePublicKey) {
      throw new Error(
        "Invalid response from TEE service: missing TeePublicKey field"
      );
    }
    if (!data.TeePublicKey.public_key) {
      throw new Error("Invalid response from TEE service: missing public key");
    }

    if (withoutAttestation) {
      this.provingServicePublicKey = secp.Point.fromHex(
        data.TeePublicKey.public_key
      );
      return;
    }

    if (!data.TeePublicKey.attestation_document) {
      throw new Error(
        "Invalid response from TEE service: missing attestation document"
      );
    }

    await verifyAttestation(data.TeePublicKey.attestation_document);

    this.provingServicePublicKey = secp.Point.fromHex(
      data.TeePublicKey.public_key
    );
  }

  async prove(
    circuitType: "NewAccount" | "Deposit" | "Withdraw",
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
      user_public_key: pk
    });

    const encryptedPayload = await encrypt(
      payload,
      this.provingServicePublicKey
    ).catch((e) => {
      throw new Error(`Failed to encrypt payload: ${e}`);
    });

    const base64Payload = bytesToBase64(encryptedPayload);

    const response = await fetch(`${this.provingServiceUrl}/proof`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payload: base64Payload
      })
    });

    if (!response.ok) {
      throw new Error(
        `Failed to prove with TEE service: ${JSON.stringify(response)}`
      );
    }
    const data = (await response.json()) as {
      EncryptedProof: {
        proof: string;
        pub_inputs: string;
      };
    };

    if (!data.EncryptedProof) {
      throw new Error(
        "Invalid response from TEE service: missing EncryptedProof"
      );
    }
    if (!data.EncryptedProof.proof) {
      throw new Error("Invalid response from TEE service: missing proof");
    }
    if (!data.EncryptedProof.pub_inputs) {
      throw new Error("Invalid response from TEE service: missing pub_inputs");
    }

    return {
      proof: await decrypt(
        base64ToBytes(data.EncryptedProof.proof),
        uint8ToHex(sk)
      ),
      pubInputs: await decrypt(
        base64ToBytes(data.EncryptedProof.pub_inputs),
        uint8ToHex(sk)
      )
    };
  }
}
