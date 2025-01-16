import { expect, test } from "@jest/globals";
import {
  isBigintScalar,
  Scalar,
  scalarsEqual,
  scalarToBigint
} from "../src/scalar";
import { execSync } from "child_process";

export const r =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

test("isBigintScalar assertion", () => {
  for (const testTuple of [
    [0n, true],
    [2n ** 128n, true],
    [2n ** 253n, true],
    [r - 1n, true],
    [r, false],
    [2n ** 254n, false]
  ]) {
    const testValue = testTuple[0] as bigint;
    const result = isBigintScalar(testValue);
    expect(result).toBe(testTuple[1] as boolean);
  }
});

test("scalar from bigint conversion", () => {
  for (const testValue of [r, 2n ** 254n]) {
    expect(() => Scalar.fromBigint(testValue)).toThrow("not a scalar");
  }

  for (const testTuple of [
    [0n, new Uint8Array(32)],
    [2n ** 128n, Object.assign(new Uint8Array(32), { 16: 1 })],
    [2n ** 253n, Object.assign(new Uint8Array(32), { 31: 32 })],
    [
      r - 1n,
      new Uint8Array([
        0, 0, 0, 240, 147, 245, 225, 67, 145, 112, 185, 121, 72, 232, 51, 40,
        93, 88, 129, 129, 182, 69, 80, 184, 41, 160, 49, 225, 114, 78, 100, 48
      ])
    ],
    [1n, Object.assign(new Uint8Array(32), { 0: 1 })]
  ]) {
    const testValue = testTuple[0] as bigint;
    const result = Scalar.fromBigint(testValue).bytes;
    expect(result).toEqual(testTuple[1] as Uint8Array);
  }
});

test("scalar to bigint conversion", () => {
  for (const testValue of [0n, 1n, 2n ** 253n]) {
    const result = scalarToBigint(Scalar.fromBigint(testValue));
    expect(result).toEqual(testValue);
  }
});

test("address to scalar", () => {
  const address: `0x${string}` = "0x7FfA893F1671600ec9b09542B5a432593720B3ee";
  const expectedBigint = 730628970045053736271125760982829093258348508142n;
  const result = scalarToBigint(Scalar.fromAddress(address));
  expect(result).toEqual(expectedBigint);
});

test("scalar equality", () => {
  const scalar1 = Scalar.fromBigint(1n);
  const scalar1Copy = Scalar.fromBigint(1n);
  const scalar2 = Scalar.fromBigint(2n);

  expect(scalarsEqual(scalar1, scalar1Copy)).toBe(true);
  expect(scalarsEqual(scalar1, scalar2)).toBe(false);
});
