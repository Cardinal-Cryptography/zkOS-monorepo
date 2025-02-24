import type { Token } from "@cardinal-cryptography/shielder-sdk";
import type { RegistrarFixture } from "../registrar";
import type { ShielderClientFixture } from "../shielderClient";
import type { WithdrawalAccountFixture } from "../withdrawalAccount";
import type { BalanceRecorderFixture } from "../counter";
import { tokenToKey } from "@/testUtils";

export const validateShielderBalance =
  (
    shielderClient: ShielderClientFixture,
    registrar: RegistrarFixture,
    token: Token
  ) =>
  async () => {
    const shieldedBalance = await shielderClient.shieldedBalance(token);
    const expectedBalance = registrar.recordedBalance(token);
    if (shieldedBalance !== expectedBalance) {
      throw new Error(
        `Balance mismatch: expected ${expectedBalance}, got ${shieldedBalance}`
      );
    }
  };

export const validateWithdrawnBalance =
  (
    withdrawalAccount: WithdrawalAccountFixture,
    recorder: BalanceRecorderFixture,
    token: Token
  ) =>
  async () => {
    const withdrawnBalance = await withdrawalAccount.balance(token);
    const expectedBalance = recorder.recordedBalance(token);
    if (withdrawnBalance !== expectedBalance) {
      throw new Error(
        `Balance mismatch: expected ${expectedBalance}, got ${withdrawnBalance}`
      );
    }
  };

export const validateShielderHistory =
  (
    shielderClient: ShielderClientFixture,
    registrar: RegistrarFixture,
    token: Token
  ) =>
  () => {
    const txHistory = shielderClient.callbacks.txHistory(token);
    const expectedHistory = registrar.recordedTxHistory(token);
    if (txHistory.length !== expectedHistory.length) {
      throw new Error(
        `Tx history length mismatch for: expected ${expectedHistory.length}, got ${txHistory.length}`
      );
    }
    for (let i = 0; i < txHistory.length; i++) {
      const tx = txHistory[i];
      const expectedTx = expectedHistory[i];
      if (tx.type !== expectedTx.type) {
        throw new Error(
          `Tx type mismatch at index ${i}: expected ${expectedTx.type}, got ${tx.type}`
        );
      }
      if (tx.amount !== expectedTx.amount) {
        throw new Error(
          `Tx amount mismatch at index ${i}: expected ${expectedTx.amount}, got ${tx.amount}`
        );
      }
      if (tokenToKey(tx.token) !== tokenToKey(expectedTx.token)) {
        throw new Error(
          `Wrong token at index ${i}: expected ${tokenToKey(expectedTx.token)}, got ${tokenToKey(tx.token)}`
        );
      }
      if (tx.to !== expectedTx.to) {
        throw new Error(
          `Tx to mismatch at index ${i}: expected ${expectedTx.to}, got ${tx.to}`
        );
      }
    }
  };
