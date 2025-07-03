/**
 * Type definitions for AWS Nitro Enclaves attestation verification
 */

/**
 * Structure of an AWS Nitro attestation document as defined in the specification
 */
export interface AttestationDocument {
  /** issuing Nitro hypervisor module ID */
  module_id: string;
  /** UTC time when document was created, in milliseconds since UNIX epoch */
  timestamp: number;
  /** the digest function used for calculating the register values*/
  digest: string;
  /** map of all locked PCRs at the moment the attestation document was generated */
  pcrs: Map<number, Uint8Array>;
  /** the infrastructure certificate used to sign this document, DER encoded */
  certificate: Uint8Array;
  /** issuing CA bundle for infrastructure certificate */
  cabundle: Uint8Array[];
  /** an optional DER-encoded key the attestation consumer can use to encrypt data with */
  public_key?: Uint8Array;
  /** additional signed user data, defined by protocol */
  user_data?: Uint8Array;
  /** an optional cryptographic nonce provided by the attestation consumer as a proof of authenticity */
  nonce?: Uint8Array;
}

/**
 * Verified attestation data returned after successful validation
 */
export interface AttestationResult {
  /** PCR measurements from the attestation document */
  pcrs: Map<number, Uint8Array>;
  /** Timestamp when the attestation was created */
  timestamp: number;
  /** Base64-encoded public key (if present) */
  publicKey?: string;
  /** Decoded user data as string (if present) */
  userData?: string;
}

/**
 * Components of a COSE_Sign1 signature structure
 */
export interface COSESignatureComponents {
  protectedHeader: Uint8Array;
  unprotectedHeader: Uint8Array;
  payload: Uint8Array;
  signature: Uint8Array;
}
