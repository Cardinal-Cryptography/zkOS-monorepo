import { erc20Token, nativeToken } from "@cardinal-cryptography/shielder-sdk";
import { expect } from "@playwright/test";
import { tokenContractAddresses } from "@tests/envConfig";
import { sdkTest } from "@tests/playwrightTestConfig";
import {
  clearStorageOp,
  recoverOp,
  shieldOp,
  withdrawOp,
  type TestDescription
} from "@tests/types";

const ercToken = erc20Token(tokenContractAddresses[0] as `0x${string}`);

[
  {
    id: 1,
    actions: [
      { op: shieldOp(nativeToken(), 10n ** 17n), actor: "alice" },
      { op: shieldOp(ercToken, 10n ** 17n), actor: "alice" },
      { op: shieldOp(nativeToken(), 2n * 10n ** 17n), actor: "bob" },
      { op: shieldOp(ercToken, 2n * 10n ** 17n), actor: "bob" },
      { op: clearStorageOp(), actor: "alice" },
      { op: clearStorageOp(), actor: "bob" },
      { op: recoverOp(), actor: "alice" },
      { op: recoverOp(), actor: "bob" },
      { op: shieldOp(nativeToken(), 10n ** 17n), actor: "alice" },
      { op: shieldOp(ercToken, 10n ** 17n), actor: "alice" },
      { op: shieldOp(nativeToken(), 2n * 10n ** 17n), actor: "bob" },
      { op: shieldOp(ercToken, 2n * 10n ** 17n), actor: "bob" },
      { op: withdrawOp(nativeToken(), 10n ** 17n, "dave", 0n), actor: "alice" },
      {
        op: withdrawOp(nativeToken(), 2n * 10n ** 17n, "dave", 0n),
        actor: "bob"
      },
      { op: shieldOp(nativeToken(), 3n * 10n ** 17n), actor: "charlie" },
      { op: shieldOp(ercToken, 3n * 10n ** 17n), actor: "charlie" },
      { op: shieldOp(nativeToken(), 3n * 10n ** 17n), actor: "charlie" },
      { op: shieldOp(ercToken, 3n * 10n ** 17n), actor: "charlie" },
      {
        op: withdrawOp(nativeToken(), 3n * 10n ** 17n, "dave", 0n),
        actor: "charlie"
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
