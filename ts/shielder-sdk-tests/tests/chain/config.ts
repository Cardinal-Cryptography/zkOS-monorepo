export const shielderContractAddress =
  process.env.SHIELDER_CONTRACT_ADDRESS ??
  (() => {
    throw new Error("SHIELDER_CONTRACT_ADDRESS env not defined");
  })();

export const relayerSignerAddresses =
  process.env.RELAYER_SIGNER_ADDRESSES ??
  (() => {
    throw new Error("RELAYER_SIGNER_ADDRESSES env not defined");
  })();

export const getChainConfig = () => {
  return {
    chainId: 31337,
    rpcHttpEndpoint: "http://localhost:8545",
    contractAddress: shielderContractAddress as `0x${string}`,
  };
};

export const getRelayerConfig = () => {
  return {
    address: "0xcaca0a3147bcaf6d7B706Fc5F5c325E6b0e7fb34" as `0x${string}`,
    url: "http://localhost:4141",
    relayerSignerAddresses: parseAddressesEnv(
      relayerSignerAddresses,
    ) as `0x${string}`[],
  };
};

const parseAddressesEnv = (envValue: string | undefined): string[] => {
  if (!envValue) {
    return [];
  }

  // Remove parentheses and split by space
  return envValue
    .replace(/[()]/g, "") // remove parentheses
    .trim()
    .split(" ")
    .filter(Boolean); // remove empty strings
};
