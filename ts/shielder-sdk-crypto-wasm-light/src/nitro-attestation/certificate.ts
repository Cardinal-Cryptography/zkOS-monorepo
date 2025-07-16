/**
 * Certificate validation operations for AWS Nitro attestation verification
 */

import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import { AWS_NITRO_ROOT_CERTIFICATE } from "./constants";
import { getCrypto } from "@/utils";

/**
 * Validate certificate chain against AWS Nitro root certificate
 *
 * This function performs a complete X.509 certificate chain validation to ensure
 * the attestation document was signed by a certificate trusted by AWS Nitro.
 *
 * @param certificateBytes - DER-encoded target certificate that signed the attestation
 * @param caBundleBytes - Array of DER-encoded CA certificates
 * @returns The public key from the validated certificate for signature verification
 * @throws Error if certificate validation fails
 */
export async function validateCertificateChain(
  certificateBytes: Uint8Array,
  caBundleBytes: Uint8Array[]
): Promise<CryptoKey> {
  try {
    // Parse the target certificate (the one that signed the attestation)
    const targetCert = new pkijs.Certificate({
      schema: asn1js.fromBER(certificateBytes).result
    });

    // Parse CA bundle certificates
    const caCerts = caBundleBytes.map(
      (certBytes) =>
        new pkijs.Certificate({
          schema: asn1js.fromBER(certBytes).result
        })
    );

    // Build certificate chain (excluding root cert from CA bundle)
    // AWS provides the CA bundle in order: [ROOT, INTERMEDIATE_1, ..., INTERMEDIATE_N]
    // We exclude the root since we use our own trusted root certificate
    const intermediateCerts = caCerts.slice(1);
    const certificateChain = [targetCert, ...intermediateCerts];

    // Parse AWS root certificate
    const rootCert = parseAWSRootCertificate();

    // Validate the certificate chain
    const validationEngine = new pkijs.CertificateChainValidationEngine({
      certs: certificateChain,
      trustedCerts: [rootCert]
    });

    const validationResult = await validationEngine.verify();

    if (!validationResult.result) {
      throw new Error(
        `Certificate chain validation failed: ${validationResult.resultMessage}`
      );
    }

    // Extract and return the public key for signature verification
    return await extractPublicKeyFromCertificate(targetCert);
  } catch (error) {
    throw new Error(
      `Certificate validation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse the AWS Nitro root certificate from PEM format
 *
 * @returns Parsed PKI.js Certificate object
 */
function parseAWSRootCertificate(): pkijs.Certificate {
  const base64Cert = AWS_NITRO_ROOT_CERTIFICATE.replace(
    /(-----(BEGIN|END) CERTIFICATE-----|[\n\r])/g,
    ""
  );

  const certBytes = Uint8Array.from(atob(base64Cert), (c) => c.charCodeAt(0));

  return new pkijs.Certificate({
    schema: asn1js.fromBER(certBytes).result
  });
}

/**
 * Extract public key from certificate for signature verification
 *
 * This function extracts the public key from the certificate's Subject Public Key Info
 * and converts it to a format suitable for use with the Web Crypto API.
 *
 * @param certificate - The certificate to extract the public key from
 * @returns CryptoKey suitable for ECDSA signature verification
 */
async function extractPublicKeyFromCertificate(
  certificate: pkijs.Certificate
): Promise<CryptoKey> {
  const cryptoApi = await getCrypto();
  // Get the Subject Public Key Info (SPKI) from the certificate
  const spkiBytes =
    certificate.subjectPublicKeyInfo.subjectPublicKey.toBER(false);

  // Remove the first 3 bytes (ASN.1/DER encoding overhead) to get raw key data
  // This is specific to how PKI.js encodes the public key data
  const publicKeyBytes = spkiBytes.slice(3);

  // Import the key for use with Web Crypto API
  // AWS Nitro uses ECDSA with P-384 curve for attestation signatures
  return await cryptoApi.subtle.importKey(
    "raw",
    publicKeyBytes,
    {
      name: "ECDSA",
      namedCurve: "P-384"
    },
    true,
    ["verify"]
  );
}
