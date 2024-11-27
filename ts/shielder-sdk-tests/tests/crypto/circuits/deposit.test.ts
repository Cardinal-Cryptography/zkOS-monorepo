import { expect } from "@playwright/test";
import { sdkTest } from "@tests/playwrightTestUtils";

sdkTest("proves and verifies", async ({ workerPage }) => {
  const isGood = await workerPage.evaluate(async () => {
    const depositCircuit = window.crypto.createDepositCircuit();
    const hasher = window.crypto.createHasher();
    const depositValues = window.crypto.testUtils.exampleDepositValues(hasher);

    depositCircuit.proveAndVerify(depositValues);
    return true;
  });
  expect(isGood).toBe(true);
});

sdkTest("does not verify incorrect proof", async ({ workerPage }) => {
  const result = await workerPage.evaluate(async () => {
    const depositCircuit = window.crypto.createDepositCircuit();
    const hasher = window.crypto.createHasher();
    const depositValues = window.crypto.testUtils.exampleDepositValues(hasher);
    const { proof, pubInputs } = depositCircuit.prove(depositValues);

    proof[0] += 1;

    try {
      depositCircuit.verify(proof, pubInputs);
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
