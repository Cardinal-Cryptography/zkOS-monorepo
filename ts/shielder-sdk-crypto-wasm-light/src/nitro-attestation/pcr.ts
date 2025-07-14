/**
 * PCR (Platform Configuration Register) validation for AWS Nitro attestation verification
 */

import { EXPECTED_PCR_MEASUREMENTS } from "./constants";
import { uint8ToHex } from "@/utils";

/**
 * Verify PCR measurements against expected values
 *
 * PCRs (Platform Configuration Registers) contain cryptographic measurements
 * of the enclave's code and configuration. These must match expected values
 * to ensure the enclave is running trusted code.
 *
 * @param actualPCRs - Map of PCR index to PCR value from the attestation document
 * @throws Error if any PCR measurement doesn't match expected values
 */
export function verifyPCRMeasurements(
  actualPCRs: Map<number, Uint8Array>
): void {
  for (const [expectedIndex, expectedValue] of Object.entries(
    EXPECTED_PCR_MEASUREMENTS
  )) {
    const pcrIndex = parseInt(expectedIndex);
    const actualValue = actualPCRs.get(pcrIndex);

    if (!actualValue) {
      throw new Error(`Missing PCR${pcrIndex} in attestation document`);
    }

    const actualHex = uint8ToHex(actualValue);
    if (actualHex !== expectedValue) {
      throw new Error(
        `PCR${pcrIndex} measurement mismatch:\n` +
          `  Expected: ${expectedValue}\n` +
          `  Actual:   ${actualHex}`
      );
    }
  }
}

/**
 * Extract PCR values from attestation data for external use
 *
 * @param pcrs - Map of PCR measurements from the attestation document
 * @returns Object mapping PCR indices to hex-encoded values
 */
export function extractPCRValues(
  pcrs: Map<number, Uint8Array>
): Record<string, string> {
  const result: Record<string, string> = {};

  if (pcrs) {
    for (const [index, value] of pcrs.entries()) {
      // Only include standard PCRs (0-4) used by Nitro Enclaves
      if (index > 4) continue;
      result[index.toString()] = uint8ToHex(value);
    }
  }

  return result;
}

/**
 * Validate PCR structure and format
 *
 * @param pcrs - Map of PCR measurements to validate
 * @throws Error if PCR structure is invalid
 */
export function validatePCRStructure(pcrs: Map<number, Uint8Array>): void {
  if (!(pcrs instanceof Map) || pcrs.size === 0) {
    throw new Error("Invalid PCRs: must be non-empty Map");
  }

  for (const [index, value] of pcrs.entries()) {
    if (typeof index !== "number" || index < 0 || index >= 32) {
      throw new Error(`Invalid PCR index: ${index} (must be 0-31)`);
    }

    if (!(value instanceof Uint8Array)) {
      throw new Error(
        `Invalid PCR value for index ${index}: must be Uint8Array`
      );
    }

    // PCR values should be 32, 48, or 64 bytes (SHA-256, SHA-384, or SHA-512)
    if (![32, 48, 64].includes(value.length)) {
      throw new Error(
        `Invalid PCR value length for index ${index}: ${value.length} bytes (expected 32, 48, or 64)`
      );
    }
  }
}
