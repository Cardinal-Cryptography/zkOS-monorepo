import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestUtils";

sdkTest("proves and verifies", async ({ workerPage }) => {
  const isGood = await workerPage.evaluate(async () => {
    const newAccount = window.crypto.createNewAccountCircuit();
    const newAccountValues = window.crypto.testUtils.exampleNewAccountValues();

    newAccount.proveAndVerify(newAccountValues);
    return true;
  });
  expect(isGood).toBe(true);
});

sdkTest("does not verify incorrect proof", async ({ workerPage }) => {
  const result = await workerPage.evaluate(async () => {
    const newAccount = window.crypto.createNewAccountCircuit();
    const newAccountValues = window.crypto.testUtils.exampleNewAccountValues();

    const { proof, pubInputs } = newAccount.proveAndVerify(newAccountValues);

    proof[0] += 1;

    try {
      newAccount.verify(proof, pubInputs);
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
