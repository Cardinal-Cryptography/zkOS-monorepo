/**
 * Constants and configuration for AWS Nitro Enclaves attestation verification
 */

/**
 * AWS Nitro Enclaves Root Certificate
 * This is the public root certificate used to validate all Nitro attestation documents.
 */
export const AWS_NITRO_ROOT_CERTIFICATE = `
-----BEGIN CERTIFICATE-----
MIICETCCAZagAwIBAgIRAPkxdWgbkK/hHUbMtOTn+FYwCgYIKoZIzj0EAwMwSTEL
MAkGA1UEBhMCVVMxDzANBgNVBAoMBkFtYXpvbjEMMAoGA1UECwwDQVdTMRswGQYD
VQQDDBJhd3Mubml0cm8tZW5jbGF2ZXMwHhcNMTkxMDI4MTMyODA1WhcNNDkxMDI4
MTQyODA1WjBJMQswCQYDVQQGEwJVUzEPMA0GA1UECgwGQW1hem9uMQwwCgYDVQQL
DANBV1MxGzAZBgNVBAMMEmF3cy5uaXRyby1lbmNsYXZlczB2MBAGByqGSM49AgEG
BSuBBAAiA2IABPwCVOumCMHzaHDimtqQvkY4MpJzbolL//Zy2YlES1BR5TSksfbb
48C8WBoyt7F2Bw7eEtaaP+ohG2bnUs990d0JX28TcPQXCEPZ3BABIeTPYwEoCWZE
h8l5YoQwTcU/9KNCMEAwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUkCW1DdkF
R+eWw5b6cp3PmanfS5YwDgYDVR0PAQH/BAQDAgGGMAoGCCqGSM49BAMDA2kAMGYC
MQCjfy+Rocm9Xue4YnwWmNJVA44fA0P5W2OpYow9OYCVRaEevL8uO1XYru5xtMPW
rfMCMQCi85sWBbJwKKXdS6BptQFuZbT73o/gBh1qUxl/nNr12UO8Yfwr6wPLb+6N
IwLz3/Y=
-----END CERTIFICATE-----
`;

/**
 * Expected PCR (Platform Configuration Register) measurements for the enclave.
 *
 * TODO: Replace with actual measurements from your enclave build process
 */
export const EXPECTED_PCR_MEASUREMENTS = {
  0: "84a3d1f71b260580211bb51d1f7a42970ca03790de5e5e7cb5bfb7a0ba852377a2a8178926825d79c875855805ebe318",
  1: "4b4d5b3661b3efc12920900c80e126e4ce783c522de6c02a2a5bf7af3a2b9327b86776f188e4be1c1c404a129dbda493",
  2: "40c32b3120d25fa9bda3feb85c30eefc280898c4496ca9e586108bb45b54c44bf66845cde172d7c674a8ee3cf2f30dfc"
} as const;

/**
 * CBOR byte position that needs manual correction for COSE signature verification.
 * This is a workaround for a compatibility issue between the cbor-web library
 * and AWS Nitro's COSE implementation.
 */
export const CBOR_SIGNATURE_FIX_POSITION = 17;
export const CBOR_SIGNATURE_FIX_VALUE = 64;

/**
 * Supported digest algorithms for PCR calculations
 */
export const SUPPORTED_DIGEST_ALGORITHMS = ["SHA384"];

/**
 * Maximum number of PCRs that can be present in an attestation document
 */
export const MAX_PCR_COUNT = 32;
