import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestConfig";
import { ShortTx } from "@tests/types";

function newAccountOp(amount: bigint): ShortTx {
  return {
    type: "NewAccount",
    amount
  };
}

function depositOp(amount: bigint): ShortTx {
  return {
    type: "Deposit",
    amount
  };
}

function withdrawOp(amount: bigint, to: `0x${string}`): ShortTx {
  return {
    type: "Withdraw",
    amount,
    to
  };
}

const WITHDRAW_ADDRESS: `0x${string}` =
  "0x7c61C790FB9D4BCb6db23c5f4ef3231BdB6B4040";
[
  // { id: 1, ops: [newAccountOp(2n)] },
  // { id: 2, ops: [newAccountOp(2n), depositOp(3n)] },
  {
    id: 3,
    ops: [
      newAccountOp(2n),
      depositOp(10n ** 18n),
      withdrawOp(4n, WITHDRAW_ADDRESS)
    ]
  }
].forEach(({ id, ops }) => {
  sdkTest(
    `shield, validate positive callbacks, test no. ${id}`,
    async ({ workerPage, perTestConfig }) => {
      const isGood = await workerPage.evaluate(
        async ({ perTestConfig: { webSdk }, ops }) => {
          const { getBalance, shield, withdraw, callbacks } = webSdk.alice;

          const nativeToken = window.shielder.nativeToken();

          let expectedSum = 0n;

          let withdrawnSum = 0n;

          for (const op of ops) {
            if (op.type == "NewAccount" || op.type == "Deposit") {
              await shield(nativeToken, op.amount);
              expectedSum += op.amount;
            }
            if (op.type == "Withdraw") {
              const { totalFee } = await withdraw(
                nativeToken,
                op.amount,
                op.to
              );
              expectedSum -= op.amount + totalFee;
              withdrawnSum += op.amount;
            }
          }

          const balance = await getBalance(nativeToken);

          console.log("balance", balance.toString(), expectedSum.toString());
          for (const tx of callbacks.txHistory()) {
            console.log(tx.type, tx.amount.toString());
          }
          for (const op of ops) {
            console.log(op.type, op.amount.toString());
          }

          return (
            balance == expectedSum &&
            callbacks.calldataGeneratedHistory().length == ops.length &&
            callbacks.calldataSentHistory().length == ops.length &&
            window.validators.validateTxHistory(callbacks.txHistory(), ops)
          );
        },
        {
          perTestConfig,
          ops
        }
      );
      expect(isGood).toBe(true);
    }
  );
});

// [
//   { id: 1, ops: [newAccountOp(2n)] },
//   { id: 2, ops: [newAccountOp(2n), depositOp(3n)] }
// ].forEach(({ id, ops }) => {
//   sdkTest(
//     `shield, recover after state reset, test no. ${id}`,
//     async ({ workerPage, perTestConfig }) => {
//       const isGood = await workerPage.evaluate(
//         async ({ perTestConfig: { webSdk }, ops }) => {
//           const { getBalance, shield, callbacks, storage, shielderClient } =
//             webSdk.alice;

//           const nativeToken = window.shielder.nativeToken();

//           let expectedSum = 0n;

//           for (const op of ops) {
//             await shield(nativeToken, op.amount);
//             expectedSum += op.amount;
//           }
//           // clear storage
//           storage.clear();
//           callbacks.clearHistory();

//           // recover
//           await shielderClient.syncShielderToken(nativeToken);

//           const balance = await getBalance(nativeToken);

//           return (
//             balance == expectedSum &&
//             window.validators.validateTxHistory(callbacks.txHistory(), ops)
//           );
//         },
//         {
//           perTestConfig,
//           ops
//         }
//       );
//       expect(isGood).toBe(true);
//     }
//   );
// });
