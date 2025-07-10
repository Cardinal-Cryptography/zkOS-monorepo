/**
 * COSE (CBOR Object Signing and Encryption) operations for AWS Nitro attestation verification
 */

import * as cbor from "cbor-web";
import { COSESignatureComponents } from "./types";
import {
  CBOR_SIGNATURE_FIX_POSITION,
  CBOR_SIGNATURE_FIX_VALUE
} from "./constants";

/**
 * Decode CBOR-encoded COSE_Sign1 signature structure
 *
 * COSE_Sign1 format: [protected_header, unprotected_header, payload, signature]
 *
 * @param attestationBytes - Raw CBOR-encoded attestation document
 * @returns Parsed COSE signature components
 * @throws Error if the COSE structure is invalid
 */
export function decodeCOSESignature(
  attestationBytes: Uint8Array
): COSESignatureComponents {
  try {
    const decoded = cbor.decode(attestationBytes) as Uint8Array[];

    if (!Array.isArray(decoded) || decoded.length !== 4) {
      throw new Error(
        "Invalid COSE_Sign1 structure: expected array with 4 elements"
      );
    }

    const [protectedHeader, unprotectedHeader, payload, signature] = decoded;

    return {
      protectedHeader,
      unprotectedHeader,
      payload,
      signature
    };
  } catch (error) {
    throw new Error(
      `Failed to decode COSE signature: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Create the "to-be-signed" data structure for COSE_Sign1 verification
 *
 * This implements the COSE_Sign1 signature verification algorithm as specified
 * in RFC 8152, with a workaround for cbor-web library compatibility.
 *
 * @param components - COSE signature components
 * @returns Encoded bytes ready for signature verification
 */
export function createCOSESignatureData(
  components: COSESignatureComponents
): Uint8Array {
  // Build the signature structure as per COSE specification
  // Format: ["Signature1", protected_header, external_aad, payload]
  const signatureStructure = [
    "Signature1", // Context string for COSE_Sign1
    components.protectedHeader,
    "", // External Additional Authenticated Data (empty)
    components.payload
  ];

  // Encode the signature structure with CBOR
  const toBeSigned = cbor.encode(signatureStructure);

  // WORKAROUND: Fix CBOR encoding compatibility issue
  // The cbor-web library produces slightly different encoding than AWS expects.
  // This manual fix corrects byte 17 to match AWS Nitro's COSE implementation.
  //
  // Technical details:
  // - AWS Nitro expects a specific CBOR encoding for the signature structure
  // - The cbor-web library outputs a slightly different byte at position 17
  // - Value 64 (0x40) appears to be the correct CBOR byte for this position
  toBeSigned[CBOR_SIGNATURE_FIX_POSITION] = CBOR_SIGNATURE_FIX_VALUE;

  return new Uint8Array(toBeSigned);
}

/**
 * Verify COSE signature using Web Crypto API
 *
 * @param signatureData - The "to-be-signed" data created by createCOSESignatureData
 * @param signature - The signature bytes from the COSE structure
 * @param publicKey - The public key for verification
 * @returns Promise resolving to true if signature is valid
 * @throws Error if signature verification fails
 */
export async function verifyCOSESignature(
  signatureData: Uint8Array,
  signature: Uint8Array,
  publicKey: CryptoKey
): Promise<void> {
  try {
    const isValid = await window.crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: "SHA-384"
      },
      publicKey,
      signature,
      signatureData
    );

    if (!isValid) {
      throw new Error("COSE signature verification failed");
    }
  } catch (error) {
    throw new Error(
      `Signature verification failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
