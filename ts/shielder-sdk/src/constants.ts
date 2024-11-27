export const chainName = "Azero";
export const chainNativeCurrency = {
  name: "AZERO",
  symbol: "AZERO",
  decimals: 18
};
export const contractVersion = "0x000001";
export const relayerFee = 100000000000000000n;
export const relayPath = "/relay";
/**
 * Gas limit for shield action: newAccount or deposit
 * Originally they have ~2M gas limit, but we set it to 3M to be safe
 */
export const shieldActionGasLimit = 3_000_000n;
