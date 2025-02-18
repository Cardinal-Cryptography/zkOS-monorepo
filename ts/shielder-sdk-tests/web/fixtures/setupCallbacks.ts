import {
  ShielderCallbacks,
  ShielderOperation,
  ShielderTransaction
} from "@cardinal-cryptography/shielder-sdk";

export interface CallbacksFixture {
  callbacks: ShielderCallbacks;
  txHistory: () => ShielderTransaction[];
  calldataGeneratedHistory: () => ShielderOperation[];
  calldataSentHistory: () => ShielderOperation[];
  clearHistory: () => void;
}

export const setupCallbacks = (): CallbacksFixture => {
  let txHistory: ShielderTransaction[] = [];
  let calldataGeneratedHistory: ShielderOperation[] = [];
  let calldataSentHistory: ShielderOperation[] = [];

  const callbacks: ShielderCallbacks = {
    onNewTransaction: (tx) => {
      txHistory.push(tx);
    },
    onCalldataGenerated: (_, op) => {
      calldataGeneratedHistory.push(op);
    },
    onCalldataSent: (_, op) => {
      calldataSentHistory.push(op);
    }
  };

  const clearHistory = () => {
    txHistory = [];
    calldataGeneratedHistory = [];
    calldataSentHistory = [];
  };

  return {
    callbacks,
    txHistory: () => txHistory,
    calldataGeneratedHistory: () => calldataGeneratedHistory,
    calldataSentHistory: () => calldataSentHistory,
    clearHistory
  };
};
