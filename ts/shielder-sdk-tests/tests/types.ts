import type { Token } from "@cardinal-cryptography/shielder-sdk";
import type { ACCOUNT_NAMES } from "./constants";

export type AccountNames = (typeof ACCOUNT_NAMES)[number];

export type AccountValue<T> = Record<AccountNames, T>;

export type ShieldOp = {
  type: "shield";
  token: Token;
  amount: bigint;
};

export type WithdrawOp = {
  type: "withdraw";
  token: Token;
  amount: bigint;
  to: AccountNames;
  pocketMoney: bigint;
};

export type WithdrawManualOp = {
  type: "withdrawManual";
  token: Token;
  amount: bigint;
  to: AccountNames;
};

export type ClearStorageOp = {
  type: "clearStorage";
};

export type RecoverOp = {
  type: "recover";
};

export type TestAction = {
  op: ShieldOp | WithdrawOp | ClearStorageOp | RecoverOp | WithdrawManualOp;
  actor: AccountNames;
};

export type TestDescription = {
  id: number;
  actions: TestAction[];
};

export function shieldOp(token: Token, amount: bigint): ShieldOp {
  return {
    type: "shield",
    amount,
    token
  };
}

export function withdrawOp(
  token: Token,
  amount: bigint,
  to: AccountNames,
  pocketMoney: bigint
): WithdrawOp {
  return {
    type: "withdraw",
    amount,
    to,
    token,
    pocketMoney
  };
}

export function withdrawManualOp(
  token: Token,
  amount: bigint,
  to: AccountNames
): WithdrawManualOp {
  return {
    type: "withdrawManual",
    amount,
    to,
    token
  };
}

export function clearStorageOp(): ClearStorageOp {
  return {
    type: "clearStorage"
  };
}

export function recoverOp(): RecoverOp {
  return {
    type: "recover"
  };
}

// Shielder-related transaction representation, omitting the details like txHash, blockNumber, etc.
export type ShortTx = {
  type: "NewAccount" | "Deposit" | "Withdraw" | "PocketMoney";
  token: Token;
  amount: bigint;
  to?: `0x${string}`;
};
