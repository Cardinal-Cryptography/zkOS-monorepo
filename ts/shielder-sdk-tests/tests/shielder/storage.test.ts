import { erc20Token, nativeToken } from "@cardinal-cryptography/shielder-sdk";
import { expect } from "@playwright/test";
import { tokenContractAddresses } from "@tests/envConfig";
import { sdkTest } from "@tests/playwrightTestConfig";
import { clearStorageOp, shieldOp, type TestDescription } from "@tests/types";

const ercToken = erc20Token(tokenContractAddresses[0] as `0x${string}`);
const protocolFee = 0n;
const memo = new Uint8Array();

[
  {
    id: 1,
    actions: [
      // create native account
      {
        op: shieldOp(nativeToken(), 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      // create erc20 account
      {
        op: shieldOp(ercToken, 2n * 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      // clear storage, don't recover
      { op: clearStorageOp(), actor: "alice" },
      // new shield will throw
      {
        op: shieldOp(nativeToken(), 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      {
        op: shieldOp(ercToken, 2n * 10n ** 17n, protocolFee, memo),
        actor: "alice"
      }
    ]
  } as TestDescription,
  {
    id: 2,
    actions: [
      // create native account
      {
        op: shieldOp(nativeToken(), 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      // deposit into native account
      {
        op: shieldOp(nativeToken(), 2n * 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      // create erc20 account
      {
        op: shieldOp(ercToken, 2n * 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      // deposit into erc20 account
      {
        op: shieldOp(ercToken, 2n * 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      // clear storage, don't recover
      { op: clearStorageOp(), actor: "alice" },
      // new shield will throw
      {
        op: shieldOp(nativeToken(), 10n ** 17n, protocolFee, memo),
        actor: "alice"
      },
      {
        op: shieldOp(ercToken, 2n * 10n ** 17n, protocolFee, memo),
        actor: "alice"
      }
    ]
  } as TestDescription
].forEach(({ id, actions }: TestDescription) => {
  sdkTest(
    `shield, clear, don't resync, expect errors on new shields. test no ${id}`,
    async ({ workerPage, perTestConfig }) => {
      const isGood = await workerPage.evaluate(
        async ({ perTestConfig: { testFixture }, actions }) => {
          let isCleared = false;
          for (const action of actions) {
            if (!isCleared) {
              await testFixture.executeAction(action);
            } else {
              let err: string | null = null;
              try {
                await testFixture.executeAction(action);
              } catch (e) {
                err = (e as Error).message;
              }
              if (!err) {
                throw new Error("Expected error, got none");
              }
            }

            if (action.op.type === "clearStorage") {
              isCleared = true;
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
