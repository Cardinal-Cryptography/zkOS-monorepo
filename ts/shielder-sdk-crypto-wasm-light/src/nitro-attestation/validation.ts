/**
 * Attestation document structure validation for AWS Nitro attestation verification
 */

import * as cbor from "cbor-web";
import { AttestationDocument } from "./types";
import { SUPPORTED_DIGEST_ALGORITHMS } from "./constants";
import { validatePCRStructure } from "./pcr";

/**
 * Parse the attestation document from CBOR-encoded payload
 *
 * @param payload - CBOR-encoded attestation document payload
 * @returns Parsed attestation document
 * @throws Error if parsing fails
 */
export function parseAttestationDocument(
  payload: Uint8Array
): AttestationDocument {
  try {
    return cbor.decode(payload) as AttestationDocument;
  } catch (error) {
    throw new Error(
      `Failed to parse attestation document: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate that the attestation document has all required fields and correct structure
 *
 * This function performs comprehensive validation of the attestation document structure
 * according to the AWS Nitro specification.
 *
 * @param doc - The attestation document to validate
 * @throws Error if validation fails
 */
export function validateAttestationDocument(doc: AttestationDocument): void {
  validateRequiredFields(doc);
  validateFieldTypes(doc);
  validateFieldValues(doc);
  validatePCRStructure(doc.pcrs);
}

/**
 * Validate that all required fields are present and not null
 */
function validateRequiredFields(doc: AttestationDocument): void {
  const requiredFields = [
    "module_id",
    "timestamp",
    "digest",
    "pcrs",
    "certificate",
    "cabundle"
  ];

  for (const field of requiredFields) {
    if (!(field in doc) || doc[field as keyof AttestationDocument] == null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

/**
 * Validate the types of all fields
 */
function validateFieldTypes(doc: AttestationDocument): void {
  if (typeof doc.module_id !== "string") {
    throw new Error("Invalid module_id: must be string");
  }

  if (typeof doc.timestamp !== "number") {
    throw new Error("Invalid timestamp: must be number");
  }

  if (typeof doc.digest !== "string") {
    throw new Error("Invalid digest: must be string");
  }

  if (!(doc.pcrs instanceof Map)) {
    throw new Error("Invalid PCRs: must be Map");
  }

  if (!(doc.certificate instanceof Uint8Array)) {
    throw new Error("Invalid certificate: must be Uint8Array");
  }

  if (!Array.isArray(doc.cabundle)) {
    throw new Error("Invalid CA bundle: must be array");
  }

  // Validate optional fields if present
  if (doc.public_key !== undefined && !(doc.public_key instanceof Uint8Array)) {
    throw new Error("Invalid public_key: must be Uint8Array");
  }

  if (doc.user_data !== undefined && !(doc.user_data instanceof Uint8Array)) {
    throw new Error("Invalid user_data: must be Uint8Array");
  }

  if (doc.nonce !== undefined && !(doc.nonce instanceof Uint8Array)) {
    throw new Error("Invalid nonce: must be Uint8Array");
  }
}

/**
 * Validate the values of all fields
 */
function validateFieldValues(doc: AttestationDocument): void {
  if (doc.module_id.length === 0) {
    throw new Error("Invalid module_id: must be non-empty string");
  }

  if (doc.timestamp <= 0) {
    throw new Error("Invalid timestamp: must be positive number");
  }

  if (!SUPPORTED_DIGEST_ALGORITHMS.includes(doc.digest as any)) {
    throw new Error(
      `Unsupported digest algorithm: ${doc.digest} (supported: ${SUPPORTED_DIGEST_ALGORITHMS.join(", ")})`
    );
  }

  if (doc.pcrs.size === 0) {
    throw new Error("Invalid PCRs: must be non-empty Map");
  }

  if (doc.certificate.length === 0) {
    throw new Error("Invalid certificate: must be non-empty");
  }

  if (doc.cabundle.length === 0) {
    throw new Error("Invalid CA bundle: must be non-empty array");
  }

  // Validate CA bundle entries
  for (let i = 0; i < doc.cabundle.length; i++) {
    const cert = doc.cabundle[i];
    if (!(cert instanceof Uint8Array) || cert.length === 0) {
      throw new Error(
        `Invalid CA bundle entry ${i}: must be non-empty Uint8Array`
      );
    }
    if (cert.length > 1024) {
      throw new Error(
        `Invalid CA bundle entry ${i}: too large (max 1024 bytes)`
      );
    }
  }

  // Validate optional field sizes
  if (doc.public_key && doc.public_key.length > 1024) {
    throw new Error("Invalid public_key: too large (max 1024 bytes)");
  }

  if (doc.user_data && doc.user_data.length > 512) {
    throw new Error("Invalid user_data: too large (max 512 bytes)");
  }

  if (doc.nonce && doc.nonce.length > 512) {
    throw new Error("Invalid nonce: too large (max 512 bytes)");
  }
}
