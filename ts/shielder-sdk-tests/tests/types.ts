import { ACCOUNT_NAMES } from "./constants";

export type AccountNames = (typeof ACCOUNT_NAMES)[number];
export type AccountKeys = {
  [K in AccountNames]: `0x${string}`;
};

export type ShieldTx = {
  type: "NewAccount" | "Deposit";
  amount: bigint;
};

export type WithdrawTx = {
  type: "Withdraw";
  amount: bigint;
  to: `0x${string}`;
};

export type ShortTx = ShieldTx | WithdrawTx;
