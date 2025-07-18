export const shielderContractAddress =
  process.env.SHIELDER_CONTRACT_ADDRESS ??
  (() => {
    throw new Error("SHIELDER_CONTRACT_ADDRESS env not defined");
  })();
export const rpcHttpEndpoint =
  process.env.RPC_HTTP_ENDPOINT ??
  (() => {
    throw new Error("RPC_HTTP_ENDPOINT env not defined");
  })();
export const relayerUrl =
  process.env.RELAYER_URL ??
  (() => {
    throw new Error("RELAYER_URL env not defined");
  })();
export const chainId =
  process.env.CHAIN_ID ??
  (() => {
    throw new Error("CHAIN_ID env not defined");
  })();
export const testnetPrivateKey =
  process.env.TESTNET_PRIVATE_KEY ??
  (() => {
    throw new Error("TESTNET_PRIVATE_KEY env not defined");
  })();
export const tokenContractAddresses = process.env.TOKEN_CONTRACT_ADDRESSES
  ? process.env.TOKEN_CONTRACT_ADDRESSES.split(",")
  : (() => {
      throw new Error("TOKEN_CONTRACT_ADDRESSES env not defined");
    })();
export const cryptoClientType = process.env.CRYPTO_CLIENT_TYPE
  ? (process.env.CRYPTO_CLIENT_TYPE as "wasm-full" | "wasm-light")
  : (() => {
      throw new Error("CRYPTO_CLIENT_TYPE env not defined");
    })();
export const proverServerUrl =
  process.env.PROVER_SERVER_URL ??
  (() => {
    throw new Error("PROVER_SERVER_URL env not defined");
  })();
export const checkNitroAttestation =
  process.env.CHECK_NITRO_ATTESTATION === "true" ||
  (cryptoClientType === "wasm-light" ? true : false);

export const getChainConfig = () => {
  return {
    chainId: parseInt(chainId),
    rpcHttpEndpoint: rpcHttpEndpoint,
    contractAddress: shielderContractAddress as `0x${string}`,
    testnetPrivateKey: testnetPrivateKey as `0x${string}`,
    tokenContractAddresses: tokenContractAddresses
  };
};

export const getRelayerConfig = () => {
  return {
    url: relayerUrl
  };
};
