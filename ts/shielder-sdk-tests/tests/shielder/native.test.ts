import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestConfig";
import { AccountNames, AccountValue, TestDescription } from "@tests/types";

function newAccountOp(amount: bigint) {
  return {
    type: "NewAccount",
    amount
  };
}

function depositOp(amount: bigint) {
  return {
    type: "Deposit",
    amount
  };
}

function withdrawOp(amount: bigint, to: AccountNames) {
  return {
    type: "Withdraw",
    amount,
    to
  };
}

[
  {
    id: 1,
    actions: [
      { op: newAccountOp(5n * 10n ** 17n), actor: "alice" },
      { op: depositOp(10n ** 18n), actor: "alice" },
      { op: withdrawOp(4n * 10n ** 17n, "dave"), actor: "alice" }
    ]
  } as TestDescription,
  {
    id: 2,
    actions: [
      { op: newAccountOp(10n ** 18n), actor: "alice" },
      { op: newAccountOp(2n * 10n ** 18n), actor: "bob" },
      { op: depositOp(10n ** 18n), actor: "alice" },
      { op: depositOp(2n * 10n ** 18n), actor: "bob" },
      { op: depositOp(100n), actor: "alice" },
      { op: depositOp(200n), actor: "bob" },
      { op: withdrawOp(10n ** 17n, "dave"), actor: "alice" },
      { op: withdrawOp(2n * 10n ** 17n, "dave"), actor: "bob" },
      { op: withdrawOp(10n ** 17n, "dave"), actor: "alice" },
      { op: withdrawOp(2n * 10n ** 17n, "dave"), actor: "bob" },
      { op: newAccountOp(3n * 10n ** 18n), actor: "charlie" },
      { op: depositOp(3n * 10n ** 18n), actor: "charlie" },
      { op: depositOp(300n), actor: "charlie" },
      { op: withdrawOp(3n * 10n ** 17n, "dave"), actor: "charlie" }
    ]
  } as TestDescription
].forEach(({ id, actions }: TestDescription) => {
  sdkTest(
    `shield, validate positive callbacks, recover accounts, test no. ${id}`,
    async ({ workerPage, perTestConfig }) => {
      const isGood = await workerPage.evaluate(
        async ({ perTestConfig: { webSdk }, actions }) => {
          const nativeToken = window.shielder.nativeToken();

          // initialize expected balances
          const expectedShieldedBalance = {} as AccountValue<bigint>;
          const expectedWithdrawnBalance = {} as AccountValue<bigint>;
          for (const untypedActor in webSdk) {
            const actor = untypedActor as AccountNames;
            expectedShieldedBalance[actor] = 0n;
            expectedWithdrawnBalance[actor] =
              await webSdk[actor].getChainBalance(nativeToken);
          }

          // execute actions
          for (const { op, actor } of actions) {
            const sdk = webSdk[actor];

            if (op.type == "NewAccount" || op.type == "Deposit") {
              await sdk.shield(nativeToken, op.amount);
              expectedShieldedBalance[actor] += op.amount;
            }
            if (op.type == "Withdraw") {
              const { totalFee } = await sdk.withdraw(
                nativeToken,
                op.amount,
                webSdk[op.to!].signerAccount.account.address
              );
              expectedShieldedBalance[actor] -= op.amount + totalFee;
              expectedWithdrawnBalance[op.to!] += op.amount;
            }
          }

          // check balances and callbacks
          for (const untypedActor in webSdk) {
            const actor = untypedActor as AccountNames;

            // check actor shielder balance
            const balance = await webSdk[actor].getBalance(nativeToken);
            if (balance != expectedShieldedBalance[actor]) {
              return false;
            }

            // check callbacks were fired
            const callbacks = webSdk[actor].callbacks;
            const actorTxes = actions.filter(({ actor: a }) => a == actor);
            if (
              callbacks.calldataGeneratedHistory().length != actorTxes.length ||
              callbacks.calldataSentHistory().length != actorTxes.length
            ) {
              return false;
            }
            // check tx history
            const txHistory = callbacks.txHistory();
            if (
              !window.validators.validateTxHistory(
                txHistory,
                actions,
                webSdk,
                actor
              )
            ) {
              return false;
            }
          }

          // check withdrawn balances
          for (const untypedActor in webSdk) {
            const actor = untypedActor as AccountNames;
            // only check if actor didn't shield
            // we omit shielding guys, cause it's hard to track their chain balances (because of gas)
            if (expectedShieldedBalance[actor] !== 0n) {
              continue;
            }
            // check withdrawn balance
            const withdrawnSum =
              await webSdk[actor].getChainBalance(nativeToken);
            if (withdrawnSum != expectedWithdrawnBalance[actor]) {
              return false;
            }
          }

          // clear storage and callbacks
          for (const untypedActor in webSdk) {
            const actor = untypedActor as AccountNames;
            webSdk[actor].storage.clear();
            webSdk[actor].callbacks.clearHistory();
          }

          // recover accounts and check balance & history
          for (const untypedActor in webSdk) {
            const actor = untypedActor as AccountNames;
            await webSdk[actor].shielderClient.syncShielderToken(nativeToken);

            // check actor shielder balance
            const balance = await webSdk[actor].getBalance(nativeToken);
            if (balance != expectedShieldedBalance[actor]) {
              return false;
            }

            // check tx history after recovery
            const txHistory = webSdk[actor].callbacks.txHistory();
            if (
              !window.validators.validateTxHistory(
                txHistory,
                actions,
                webSdk,
                actor
              )
            ) {
              return false;
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
