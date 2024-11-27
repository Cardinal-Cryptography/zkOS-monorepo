import { sdkTest, unpackUint8Array } from "@tests/playwrightTestUtils";
import { expect } from "@playwright/test";
import { execSync } from "child_process";

export const r =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

sdkTest("isBigintScalar assertion", async ({ workerPage }) => {
  for (const testTuple of [
    [0n, true],
    [2n ** 128n, true],
    [2n ** 254n, false],
    [r, false],
  ]) {
    const testValue = testTuple[0] as bigint;
    const result = await workerPage.evaluate(async (value) => {
      return window.crypto.scalar.isBigintScalar(value);
    }, testValue);
    expect(result).toBe(testTuple[1] as boolean);
  }
});

sdkTest("scalar from bigint conversion", async ({ workerPage }) => {
  for (const testValue of [r, 2n ** 254n]) {
    expect(() =>
      workerPage.evaluate(async (value) => {
        return window.crypto.scalar.fromBigint(value);
      }, testValue),
    ).rejects.toThrow("not a scalar");
  }

  for (const testTuple of [
    [0n, new Uint8Array(32)],
    [1n, Object.assign(new Uint8Array(32), { 0: 1 })],
  ]) {
    const testValue = testTuple[0] as bigint;
    const result = await workerPage.evaluate(async (value) => {
      return window.crypto.scalar.fromBigint(value).bytes;
    }, testValue);
    expect(unpackUint8Array(result)).toEqual(testTuple[1] as Uint8Array);
  }
});

sdkTest("scalar to bigint conversion", async ({ workerPage }) => {
  for (const testValue of [0n, 1n, 2n ** 253n]) {
    const result = await workerPage.evaluate(async (value) => {
      return window.crypto.scalar.scalarToBigint(
        window.crypto.scalar.fromBigint(value),
      );
    }, testValue);
    expect(result).toEqual(testValue);
  }
});

sdkTest("address to scalar", async ({ workerPage }) => {
  const address: `0x${string}` = "0x7FfA893F1671600ec9b09542B5a432593720B3ee";
  const expectedBigint = 730628970045053736271125760982829093258348508142n;
  const result = await workerPage.evaluate(async (value) => {
    return window.crypto.scalar.scalarToBigint(
      window.crypto.scalar.fromAddress(value),
    );
  }, address);
  expect(result).toEqual(expectedBigint);
});

sdkTest("scalar.fromBigint agrees with rust", async ({ workerPage }) => {
  for (const testValue of [0n, 1n, 2n ** 128n - 1n]) {
    const result = await workerPage.evaluate(async (value) => {
      return window.crypto.scalar.fromBigint(value).bytes;
    }, testValue);
    execSync(
      `../../target/debug/test-ts-conversions` +
        ` u128-equals-bytes` +
        ` ${testValue.toString()}` +
        ` ${unpackUint8Array(result).toString()}`,
      {
        stdio: "ignore",
      },
    );
  }
});

sdkTest("scalar equality", async ({ workerPage }) => {
  await workerPage.evaluate(async () => {
    const scalar1 = window.crypto.scalar.fromBigint(1n);
    const scalar1Copy = window.crypto.scalar.fromBigint(1n);
    const scalar2 = window.crypto.scalar.fromBigint(2n);
    if (!window.crypto.scalar.scalarsEqual(scalar1, scalar1Copy)) {
      throw new Error("1 == 1");
    }
    if (window.crypto.scalar.scalarsEqual(scalar1, scalar2)) {
      throw new Error("1 != 2");
    }
  });
});
