import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { contractVersion, nativeTokenAddress } from "@/constants";
import { ERC20Token, NativeToken, Token } from "./types";

export function flatUint8(arr: Uint8Array[]) {
  return new Uint8Array(
    arr.reduce((acc, val) => new Uint8Array([...acc, ...val]), new Uint8Array())
  );
}

export function noteVersion() {
  // Version is in the form of 0x{note_version}{circuit_version}{patch_version}.
  // So we need to take 3rd byte, we do so by shifting the number by 16 bits to the right.
  return Scalar.fromBigint(BigInt(contractVersion) >> 16n);
}

export function isVersionSupported(version: `0x${string}`) {
  return version === contractVersion;
}

export function nativeToken(): NativeToken {
  return { type: "native" };
}

export function erc20Token(address: `0x${string}`): ERC20Token {
  return { type: "erc20", address };
}

/**
 * Returns the address of a given token
 * @param token - The token object (either native or ERC20)
 * @returns The hexadecimal address of the token
 */
export function getAddressByToken(token: Token): `0x${string}` {
  return token.type === "native" ? nativeTokenAddress : token.address;
}

/**
 * Creates a Token object from a given address
 * @param tokenAddress - The hexadecimal address of the token
 * @returns A Token object (either native or ERC20 depending on the address)
 */
export function getTokenByAddress(tokenAddress: `0x${string}`): Token {
  return tokenAddress === nativeTokenAddress
    ? nativeToken()
    : erc20Token(tokenAddress);
}
