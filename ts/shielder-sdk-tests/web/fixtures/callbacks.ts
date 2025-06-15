import { tokenToKey } from "@/testUtils";
import type {
  ShielderCallbacks,
  ShielderTransaction,
  Token
} from "@cardinal-cryptography/shielder-sdk";

export interface CallbacksFixture {
  callbacks: ShielderCallbacks;
  txHistory: (token: Token) => ShielderTransaction[];
  clearHistory: () => void;
}

export const setupCallbacks = (): CallbacksFixture => {
  let txHistory: Map<"native" | `0x${string}`, ShielderTransaction[]> =
    new Map();

  const callbacks: ShielderCallbacks = {
    onNewTransaction: (tx) => {
      const token = tokenToKey(tx.token);
      if (!txHistory.has(token)) {
        txHistory.set(token, []);
      }
      txHistory.get(token)!.push(tx);
    },
    onAccountNotOnChain: (error, stage, operation) => {
      console.error(
        `Account not on chain during ${stage} for operation ${operation}:`,
        error
      );
    },
    onSdkOutdated: (error, stage, operation) => {
      console.warn(
        `SDK outdated during ${stage} for operation ${operation}:`,
        error
      );
    }
  };

  const clearHistory = () => {
    txHistory = new Map();
  };

  return {
    callbacks,
    txHistory: (token: Token) => {
      return txHistory.get(tokenToKey(token)) ?? [];
    },
    clearHistory
  };
};
