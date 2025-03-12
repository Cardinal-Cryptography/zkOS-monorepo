import { test, expect } from "vitest";
import { scalarToBigint } from "@cardinal-cryptography/shielder-sdk-crypto";
import {
  flatUint8,
  getAddressByToken,
  isVersionSupported,
  noteVersion
} from "../src/utils";

test("flatUint8", () => {
  const arr = [
    new Uint8Array([1, 2]),
    new Uint8Array([3, 4]),
    new Uint8Array([5, 6])
  ];
  const result = flatUint8(arr);
  expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
});

test("note version", () => {
  const result = scalarToBigint(noteVersion());
  expect(result).toBe(0n);
});

test("isVersionSupported", () => {
  expect(isVersionSupported("0x000100")).toBe(true);
  expect(isVersionSupported("0x000002")).toBe(false);
});

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";

test("getAddressByToken", () => {
  expect(getAddressByToken({ type: "native" })).toBe(nativeTokenAddress);
  expect(getAddressByToken({ type: "erc20", address: "0x123" })).toBe("0x123");
});

test("getTokenByAddress", () => {
  expect(getAddressByToken({ type: "native" })).toBe(nativeTokenAddress);
  expect(getAddressByToken({ type: "erc20", address: "0x123" })).toBe("0x123");
});
