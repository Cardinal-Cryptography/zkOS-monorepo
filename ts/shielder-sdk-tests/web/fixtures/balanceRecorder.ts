import type { Token } from "@cardinal-cryptography/shielder-sdk";

export interface BalanceRecorderFixture {
  add(token: Token, amount: bigint): void;
  recordedBalance(token: Token): bigint;
}

export const setupBalanceRecorder = (): BalanceRecorderFixture => {
  const tokenBalances = new Map<"native" | `0x${string}`, bigint>();

  const add = (token: Token, amount: bigint) => {
    const key =
      token.type === "native"
        ? "native"
        : (token.address.toLowerCase() as `0x${string}`);
    const balance = tokenBalances.get(key) ?? 0n;
    tokenBalances.set(key, balance + amount);
  };

  return {
    add,
    recordedBalance: (token: Token) => {
      const key =
        token.type === "native"
          ? "native"
          : (token.address.toLowerCase() as `0x${string}`);
      return tokenBalances.get(key) ?? 0n;
    }
  };
};
