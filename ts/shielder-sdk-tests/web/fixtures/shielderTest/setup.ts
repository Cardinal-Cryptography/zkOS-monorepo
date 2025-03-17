import type { AccountNames, AccountValue, TestAction } from "@tests/types";
import { type RegistrarFixture, setupRegistrar } from "../registrar";
import {
  setupShielderClient,
  type ShielderClientFixture
} from "../shielderClient";
import type { GlobalConfigFixture } from "@tests/playwrightFixtures/globalConfig";
import { ACCOUNT_NAMES } from "@tests/constants";
import { generatePrivateKey } from "viem/accounts";
import {
  setupWithdrawalAccount,
  type WithdrawalAccountFixture
} from "../withdrawalAccount";
import {
  type BalanceRecorderFixture,
  setupBalanceRecorder
} from "../balanceRecorder";
import {
  validateShielderBalance as validateShielderBalanceSingle,
  validateWithdrawnBalance as validateWithdrawnBalanceSingle,
  validateShielderHistory as validateShielderHistorySingle
} from "./validate";
import { keyToToken, tokenToKey } from "@/testUtils";

export interface ShielderTestFixture {
  executeAction: (action: TestAction) => Promise<void>;
  validateShielderBalance: (actor: AccountNames) => Promise<void>;
  validateWithdrawnBalance: (actor: AccountNames) => Promise<void>;
  validateShielderHistory: (actor: AccountNames) => void;
}

export const setupShielderTest = async (globalConfig: GlobalConfigFixture) => {
  const shielderClients = {} as AccountValue<ShielderClientFixture>;
  const withdrawalAccounts = {} as AccountValue<WithdrawalAccountFixture>;
  const registrars = {} as AccountValue<RegistrarFixture>;
  const withdrawnBalance = {} as AccountValue<BalanceRecorderFixture>;

  const usedTokens = new Set<"native" | `0x${string}`>();

  for (const name of ACCOUNT_NAMES) {
    const shielderKey = generatePrivateKey();
    shielderClients[name] = await setupShielderClient(
      globalConfig.chainConfig,
      globalConfig.relayerConfig,
      globalConfig.privateKeys[name],
      shielderKey
    );

    const withdrawalKey = generatePrivateKey();
    withdrawalAccounts[name] = setupWithdrawalAccount(
      withdrawalKey,
      globalConfig.chainConfig.chainId,
      globalConfig.chainConfig.rpcHttpEndpoint
    );

    registrars[name] = setupRegistrar();
    withdrawnBalance[name] = setupBalanceRecorder();
  }

  const executeAction = async (action: TestAction) => {
    try {
      const shielderClient = shielderClients[action.actor];
      const registrar = registrars[action.actor];
      if (action.op.type === "shield") {
        await shielderClient.shield(action.op.token, action.op.amount);
        registrar.registerShield(action.op.token, action.op.amount);
        usedTokens.add(tokenToKey(action.op.token));
      } else if (action.op.type === "withdraw") {
        const { totalFee } = await shielderClient.withdraw(
          action.op.token,
          action.op.amount,
          withdrawalAccounts[action.op.to].address
        );
        registrar.registerWithdrawal(
          action.op.token,
          withdrawalAccounts[action.op.to].address,
          action.op.amount + totalFee
        );
        withdrawnBalance[action.op.to].add(action.op.token, action.op.amount);
        usedTokens.add(tokenToKey(action.op.token));
      } else if (action.op.type === "withdrawManual") {
        await shielderClient.withdrawManual(
          action.op.token,
          action.op.amount,
          withdrawalAccounts[action.op.to].address
        );
        registrar.registerWithdrawal(
          action.op.token,
          withdrawalAccounts[action.op.to].address,
          action.op.amount
        );
        withdrawnBalance[action.op.to].add(action.op.token, action.op.amount);
        usedTokens.add(tokenToKey(action.op.token));
      } else if (action.op.type === "clearStorage") {
        clearStorage(action.actor);
      } else if (action.op.type === "recover") {
        await recoverShielder(action.actor);
      } else {
        throw new Error(`Unknown action type`);
      }
    } catch (e) {
      console.error((e as Error).message);
      throw new Error((e as Error).message);
    }
  };

  const clearStorage = (actor: AccountNames) => {
    shielderClients[actor].storage.clear();
    shielderClients[actor].callbacks.clearHistory();
  };

  const recoverShielder = async (actor: AccountNames) => {
    await shielderClients[actor].shielderClient.syncShielder();
  };
  const validateShielderBalance = async (actor: AccountNames) => {
    for (const tokenKey of usedTokens) {
      const token = keyToToken(tokenKey);
      await validateShielderBalanceSingle(
        shielderClients[actor],
        registrars[actor],
        token
      )();
    }
  };

  const validateWithdrawnBalance = async (actor: AccountNames) => {
    for (const tokenKey of usedTokens) {
      const token = keyToToken(tokenKey);
      await validateWithdrawnBalanceSingle(
        withdrawalAccounts[actor],
        withdrawnBalance[actor],
        token
      )();
    }
  };

  const validateShielderHistory = (actor: AccountNames) => {
    for (const tokenKey of usedTokens) {
      const token = keyToToken(tokenKey);
      validateShielderHistorySingle(
        shielderClients[actor],
        registrars[actor],
        token
      )();
    }
  };

  return {
    executeAction,
    validateShielderBalance,
    validateWithdrawnBalance,
    validateShielderHistory
  };
};
