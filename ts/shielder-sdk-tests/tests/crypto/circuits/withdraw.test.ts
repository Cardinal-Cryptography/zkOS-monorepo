import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestUtils";

sdkTest("proves and verifies", async ({ workerPage }) => {
  const isGood = await workerPage.evaluate(async () => {
    const withdrawCircuit = window.crypto.createWithdrawCircuit();
    const hasher = window.crypto.createHasher();
    const withdrawValues =
      window.crypto.testUtils.exampleWithdrawValues(hasher);

    withdrawCircuit.proveAndVerify(withdrawValues);
    return true;
  });
  expect(isGood).toBe(true);
});

sdkTest("does not verify incorrect proof", async ({ workerPage }) => {
  const result = await workerPage.evaluate(async () => {
    const withdrawCircuit = window.crypto.createWithdrawCircuit();
    const hasher = window.crypto.createHasher();
    const withdrawValues =
      window.crypto.testUtils.exampleWithdrawValues(hasher);
    const { proof, pubInputs } = withdrawCircuit.prove(withdrawValues);

    proof[0] += 1;

    try {
      withdrawCircuit.verify(proof, pubInputs);
    } catch (error) {
      return error;
    }
    return "success";
  });

  if (result instanceof Error) {
    expect(result.message).toContain("Transcript error");
  } else {
    throw new Error(`expected an error, got '${result}'`);
  }
});
