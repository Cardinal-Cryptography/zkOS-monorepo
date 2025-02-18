import { ShielderTransaction } from "@cardinal-cryptography/shielder-sdk";

export const validateTxHistory = (
  txHistory: ShielderTransaction[],
  expected: {
    type: "NewAccount" | "Deposit" | "Withdraw";
    amount: bigint;
    to?: `0x${string}`;
  }[]
): boolean => {
  if (txHistory.length !== expected.length) {
    return false;
  }

  for (let i = 0; i < txHistory.length; i++) {
    const tx = txHistory[i];
    const expectedTx = expected[i];

    if (tx.type !== expectedTx.type) {
      return false;
    }

    if (tx.amount !== expectedTx.amount) {
      return false;
    }

    if (expectedTx.to) {
      if (tx.to !== expectedTx.to) {
        return false;
      }
    }
  }

  return true;
};
