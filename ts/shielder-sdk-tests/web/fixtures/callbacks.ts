import { tokenToKey } from "@/testUtils";
import type {
  ShielderCallbacks,
  ShielderOperation,
  ShielderTransaction,
  Token
} from "@cardinal-cryptography/shielder-sdk";

export interface CallbacksFixture {
  callbacks: ShielderCallbacks;
  txHistory: (token: Token) => ShielderTransaction[];
  calldataGeneratedHistory: () => ShielderOperation[];
  calldataSentHistory: () => ShielderOperation[];
  clearHistory: () => void;
}

export const setupCallbacks = (): CallbacksFixture => {
  let txHistory: Map<"native" | `0x${string}`, ShielderTransaction[]> =
    new Map();
  let calldataGeneratedHistory: ShielderOperation[] = [];
  let calldataSentHistory: ShielderOperation[] = [];

  const callbacks: ShielderCallbacks = {
    onNewTransaction: (tx) => {
      const token = tokenToKey(tx.token);
      if (!txHistory.has(token)) {
        txHistory.set(token, []);
      }
      txHistory.get(token)!.push(tx);
    },
    onCalldataGenerated: (_, op) => {
      calldataGeneratedHistory.push(op);
    },
    onCalldataSent: (_, op) => {
      calldataSentHistory.push(op);
    }
  };

  const clearHistory = () => {
    txHistory = new Map();
    calldataGeneratedHistory = [];
    calldataSentHistory = [];
  };

  return {
    callbacks,
    txHistory: (token: Token) => {
      return txHistory.get(tokenToKey(token)) ?? [];
    },
    calldataGeneratedHistory: () => calldataGeneratedHistory,
    calldataSentHistory: () => calldataSentHistory,
    clearHistory
  };
};
