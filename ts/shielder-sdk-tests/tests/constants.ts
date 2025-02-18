export const INITIAL_EVM_BALANCE = 10n ** 18n;

export const ACCOUNT_NAMES = ["alice", "bob", "carol", "dave", "eve"] as const;
export type AccountNames = (typeof ACCOUNT_NAMES)[number];
export type AccountKeys = {
  [K in AccountNames]: `0x${string}`;
};
