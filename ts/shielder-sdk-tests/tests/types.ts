import type { ACCOUNT_NAMES } from "./constants";

export type AccountNames = (typeof ACCOUNT_NAMES)[number];
export type AccountValue<T> = {
  [K in AccountNames]: T;
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

export type TestDescription = {
  id: number;
  actions: {
    op: {
      type: "NewAccount" | "Deposit" | "Withdraw";
      amount: bigint;
      to?: AccountNames;
    };
    actor: AccountNames;
  }[];
};
