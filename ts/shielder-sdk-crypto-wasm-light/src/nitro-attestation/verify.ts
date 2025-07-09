/**
 * AWS Nitro Enclaves Attestation Verification
 *
 * This module provides the main entry point for verifying attestation documents
 * from AWS Nitro Enclaves.
 *
 * ## Verification Process:
 * 1. Decode the base64 attestation document
 * 2. Parse CBOR-encoded COSE signature structure
 * 3. Validate certificate chain against AWS root certificate
 * 4. Verify cryptographic signature
 * 5. Check PCR measurements against expected values
 *
 * Based on: https://github.com/aws/aws-nitro-enclaves-nsm-api/blob/main/docs/attestation_process.md
 */

import { AttestationDocument, AttestationResult } from "./types";
import { base64ToBytes, bytesToBase64 } from "./utils";
import {
  decodeCOSESignature,
  createCOSESignatureData,
  verifyCOSESignature
} from "./cose";
import { validateCertificateChain } from "./certificate";
import { verifyPCRMeasurements, extractPCRValues } from "./pcr";
import {
  parseAttestationDocument,
  validateAttestationDocument
} from "./validation";

/**
 * Verify an AWS Nitro Enclaves attestation document
 *
 * @param attestationDocBase64 - Base64-encoded attestation document from the enclave
 * @returns Verified attestation data
 * @throws Error if verification fails at any step
 */
export async function verifyAttestation(
  attestationDocBase64: string
): Promise<AttestationResult> {
  try {
    // Step 1: Parse the attestation document from base64
    const attestationBytes = base64ToBytes(attestationDocBase64);

    // Step 2: Decode CBOR and extract COSE signature components
    const coseComponents = decodeCOSESignature(attestationBytes);

    // Step 3: Parse the attestation document from the payload
    const attestationDocument = parseAttestationDocument(
      coseComponents.payload
    );

    // Step 4: Validate the document structure and required fields
    validateAttestationDocument(attestationDocument);

    // Step 5: Verify the certificate chain against AWS root certificate
    const publicKey = await validateCertificateChain(
      attestationDocument.certificate,
      attestationDocument.cabundle
    );

    // Step 6: Verify the cryptographic signature
    const signatureData = createCOSESignatureData(coseComponents);
    await verifyCOSESignature(
      signatureData,
      coseComponents.signature,
      publicKey
    );

    // Step 7: Verify PCR measurements against expected values
    verifyPCRMeasurements(attestationDocument.pcrs);

    // Step 8: Return the verified attestation data
    return buildAttestationResult(attestationDocument);
  } catch (error) {
    console.error("Attestation verification failed:", error);
    throw new Error(
      `Attestation verification failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract PCR values from verified attestation data for external use
 *
 * @param attestationData - The verified attestation result
 * @returns Object mapping PCR indices to hex-encoded values
 */
export function extractPCRs(
  attestationData: AttestationResult
): Record<string, string> {
  return extractPCRValues(attestationData.pcrs);
}

/**
 * Build the final attestation result from the verified document
 *
 * @param doc - The validated attestation document
 * @returns Structured attestation result
 */
function buildAttestationResult(doc: AttestationDocument): AttestationResult {
  return {
    pcrs: doc.pcrs,
    timestamp: doc.timestamp,
    publicKey: doc.public_key ? bytesToBase64(doc.public_key) : undefined,
    userData: doc.user_data
      ? new TextDecoder().decode(doc.user_data)
      : undefined
  };
}
