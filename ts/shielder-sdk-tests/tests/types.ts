import type { Token } from "@cardinal-cryptography/shielder-sdk";
import type { ACCOUNT_NAMES } from "./constants";

export type AccountNames = (typeof ACCOUNT_NAMES)[number];

export type AccountValue<T> = Record<AccountNames, T>;

export type ShieldOp = {
  type: "shield";
  token: Token;
  amount: bigint;
  memo: Uint8Array;
};

export type WithdrawOp = {
  type: "withdraw";
  token: Token;
  amount: bigint;
  to: AccountNames;
  pocketMoney: bigint;
  memo: Uint8Array;
};

export type WithdrawManualOp = {
  type: "withdrawManual";
  token: Token;
  amount: bigint;
  to: AccountNames;
  memo: Uint8Array;
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

export function shieldOp(
  token: Token,
  amount: bigint,
  memo: Uint8Array
): ShieldOp {
  return {
    type: "shield",
    amount,
    token,
    memo
  };
}

export function withdrawOp(
  token: Token,
  amount: bigint,
  to: AccountNames,
  pocketMoney: bigint,
  memo: Uint8Array
): WithdrawOp {
  return {
    type: "withdraw",
    amount,
    to,
    token,
    pocketMoney,
    memo
  };
}

export function withdrawManualOp(
  token: Token,
  amount: bigint,
  to: AccountNames,
  memo: Uint8Array
): WithdrawManualOp {
  return {
    type: "withdrawManual",
    amount,
    to,
    token,
    memo
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
  type: "NewAccount" | "Deposit" | "Withdraw";
  token: Token;
  amount: bigint;
  to?: `0x${string}`;
  pocketMoney?: bigint;
  protocolFee: bigint;
};
