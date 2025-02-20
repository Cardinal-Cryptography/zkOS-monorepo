import type { ShielderClientFixture } from "@/fixtures/setupShielderClient";
import type { ShielderTransaction } from "@cardinal-cryptography/shielder-sdk";
import type {
  AccountNames,
  AccountValue,
  ShortTx,
  TestDescription
} from "@tests/types";

export const validateTxHistory = (
  txHistory: ShielderTransaction[],
  actions: TestDescription["actions"],
  webSdk: AccountValue<ShielderClientFixture>,
  actor: AccountNames
): boolean => {
  const expectedTxHistory = actions
    .filter(({ actor: a }) => a == actor)
    .map(({ op }) => {
      if (op.type == "Withdraw") {
        return {
          ...op,
          to: webSdk[op.to!].signerAccount.account.address
        } as ShortTx;
      } else
        return {
          ...op,
          to: undefined
        } as ShortTx;
    });

  if (txHistory.length !== expectedTxHistory.length) {
    return false;
  }

  for (let i = 0; i < txHistory.length; i++) {
    const tx = txHistory[i];
    const expectedTx = expectedTxHistory[i];

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
