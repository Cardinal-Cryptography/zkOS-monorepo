import { erc20Token, nativeToken } from "@cardinal-cryptography/shielder-sdk";
import { expect } from "@playwright/test";
import { tokenContractAddresses } from "@tests/envConfig";
import { sdkTest } from "@tests/playwrightTestConfig";
import {
  clearStorageOp,
  recoverOp,
  shieldOp,
  withdrawManualOp,
  withdrawOp,
  type TestDescription
} from "@tests/types";

const ercToken = erc20Token(tokenContractAddresses[0] as `0x${string}`);

[
  {
    id: 1,
    actions: [
      // create native account, deposit, withdraw manually and via relayer
      { op: shieldOp(nativeToken(), 10n ** 17n), actor: "alice" },
      { op: shieldOp(nativeToken(), 2n * 10n ** 17n), actor: "alice" },
      { op: withdrawManualOp(nativeToken(), 5n ** 17n, "bob"), actor: "alice" },
      { op: withdrawOp(nativeToken(), 7n ** 17n, "bob", 0n), actor: "alice" },

      // create ERC20 account, deposit, withdraw manually and via relayer
      { op: shieldOp(ercToken, 10n ** 17n), actor: "alice" },
      { op: shieldOp(ercToken, 2n * 10n ** 17n), actor: "alice" },
      { op: withdrawManualOp(ercToken, 5n ** 17n, "bob"), actor: "alice" },
      {
        op: withdrawOp(ercToken, 7n ** 17n, "bob", 10n ** 17n),
        actor: "alice"
      },

      // clear and recover
      { op: clearStorageOp(), actor: "alice" },
      { op: recoverOp(), actor: "alice" },

      // shield again
      { op: shieldOp(nativeToken(), 10n ** 17n), actor: "alice" },
      { op: shieldOp(ercToken, 10n ** 17n), actor: "alice" },

      // withdraw again via relayer
      {
        op: withdrawOp(nativeToken(), 10n ** 17n, "charlie", 0n),
        actor: "alice"
      },
      {
        op: withdrawOp(ercToken, 10n ** 17n, "charlie", 0n),
        actor: "alice"
      }
    ]
  } as TestDescription
].forEach(({ id, actions }: TestDescription) => {
  sdkTest(
    `shield, withdraw, recover, validate balances&history. test no ${id}`,
    async ({ workerPage, perTestConfig }) => {
      const isGood = await workerPage.evaluate(
        async ({ perTestConfig: { testFixture }, actions }) => {
          for (const action of actions) {
            await testFixture.executeAction(action);

            await testFixture.validateWithdrawnBalance(action.actor);

            if (action.op.type !== "clearStorage") {
              await testFixture.validateShielderBalance(action.actor);
              testFixture.validateShielderHistory(action.actor);
            }
          }
          return true;
        },
        {
          perTestConfig,
          actions
        }
      );
      expect(isGood).toBe(true);
    }
  );
});
