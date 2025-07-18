export const cryptoClientType: "wasm-full" | "wasm-light" =
  import.meta.env.VITE_CRYPTO_CLIENT_TYPE || "wasm-full";
export const proverServerUrl = import.meta.env.VITE_PROVER_SERVER_URL || "";
export const checkNitroAttestation =
  import.meta.env.VITE_CHECK_NITRO_ATTESTATION === "true";
