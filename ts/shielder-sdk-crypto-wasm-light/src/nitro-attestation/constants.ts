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
  0: "2a099d81a42f14435bc2c4d0399c377cd62d2462bca71ace2c1bf461a41dfe88e6913079b3c83b64d2bb06870c885612",
  1: "927e084e583f5c2d60a39e2b9cd9728bfb390aa9f83dee4b6ac768509850ba273ea8b019ccfbf3180eb18a2dd0c4a678",
  2: "bf458fd0b974d400be57fe6063900fac7d170d5d1937f41db9f851f7dbbb30894fc16f8efb017c56ac1a86f5e5b26ec0"
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
