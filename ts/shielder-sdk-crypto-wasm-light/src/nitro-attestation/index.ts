/**
 * AWS Nitro Enclaves Attestation Verification Module
 *
 * This module provides comprehensive verification of AWS Nitro Enclaves attestation
 * documents to ensure code is running in a genuine, trusted enclave environment.
 */

// Main verification functions
export { verifyAttestation, extractPCRs } from "./verify";

// Type definitions
export type {
  AttestationResult,
  AttestationDocument,
  COSESignatureComponents
} from "./types";

// Constants for external use
export {
  EXPECTED_PCR_MEASUREMENTS,
  AWS_NITRO_ROOT_CERTIFICATE
} from "./constants";

// Utility functions
export { bytesToBase64, base64ToBytes, uint8ToHex } from "./utils";

// Individual verification components (for advanced use cases)
export {
  decodeCOSESignature,
  createCOSESignatureData,
  verifyCOSESignature
} from "./cose";
export { validateCertificateChain } from "./certificate";
export {
  verifyPCRMeasurements,
  extractPCRValues,
  validatePCRStructure
} from "./pcr";
export {
  parseAttestationDocument,
  validateAttestationDocument
} from "./validation";
