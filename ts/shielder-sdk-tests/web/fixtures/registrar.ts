import { Token } from "@cardinal-cryptography/shielder-sdk";
import type { ShortTx } from "@tests/types";
import { setupBalanceRecorder } from "./balanceRecorder";

export interface RegistrarFixture {
  registerShield(token: Token, amount: bigint, protocolFee: bigint): void;

  registerWithdrawal(
    token: Token,
    to: `0x${string}`,
    amount: bigint,
    pocketMoney: bigint,
    protocolFee: bigint
  ): void;

  recordedBalance(token: Token): bigint;

  recordedTxHistory(token: Token): ShortTx[];
}

export const setupRegistrar = (): RegistrarFixture => {
  const balanceRecorder = setupBalanceRecorder();
  const tokenTxHistory = new Map<"native" | `0x${string}`, ShortTx[]>();

  const registerShield = (
    token: Token,
    amount: bigint,
    protocolFee: bigint
  ) => {
    balanceRecorder.add(token, amount - protocolFee);

    const key =
      token.type === "native"
        ? "native"
        : (token.address.toLowerCase() as `0x${string}`);
    if (!tokenTxHistory.has(key)) {
      tokenTxHistory.set(key, []);
    }
    // new account if not existing
    if (tokenTxHistory.get(key)!.length === 0) {
      tokenTxHistory.get(key)!.push({
        type: "NewAccount",
        token,
        amount,
        protocolFee
      });
    } else {
      tokenTxHistory
        .get(key)!
        .push({ type: "Deposit", token, amount, protocolFee });
    }
  };

  const registerWithdrawal = (
    token: Token,
    to: `0x${string}`,
    amount: bigint,
    pocketMoney: bigint,
    protocolFee: bigint
  ) => {
    balanceRecorder.add(token, -amount);

    const key =
      token.type === "native"
        ? "native"
        : (token.address.toLowerCase() as `0x${string}`);
    if (!tokenTxHistory.has(key)) {
      tokenTxHistory.set(key, []);
    }
    tokenTxHistory.get(key)!.push({
      type: "Withdraw",
      token,
      amount,
      to,
      pocketMoney,
      protocolFee
    });
  };

  return {
    registerShield,
    registerWithdrawal,
    recordedBalance: (token: Token) => {
      return balanceRecorder.recordedBalance(token);
    },
    recordedTxHistory: (token: Token) => {
      const key =
        token.type === "native"
          ? "native"
          : (token.address.toLowerCase() as `0x${string}`);
      return tokenTxHistory.get(key) ?? [];
    }
  };
};
