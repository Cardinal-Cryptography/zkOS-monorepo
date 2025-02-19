import { ShielderTransaction } from "@cardinal-cryptography/shielder-sdk";
import { ShortTx } from "@tests/types";

export const validateTxHistory = (
  txHistory: ShielderTransaction[],
  expected: ShortTx[]
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

    if (expectedTx.type === "Withdraw") {
      if (tx.to === undefined || tx.relayerFee === undefined) return false;
      if (tx.to !== expectedTx.to) {
        return false;
      }
      if (tx.amount - tx.relayerFee !== expectedTx.amount) {
        return false;
      }
    } else {
      if (tx.amount !== expectedTx.amount) {
        return false;
      }
    }
  }

  return true;
};
