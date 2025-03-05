import { Scalar } from "@cardinal-cryptography/shielder-sdk-crypto";
import { contractVersion, nativeTokenAddress } from "@/constants";
import { erc20Token, nativeToken, Token } from "./types";

export function flatUint8(arr: Uint8Array[]) {
  return new Uint8Array(
    arr.reduce((acc, val) => new Uint8Array([...acc, ...val]), new Uint8Array())
  );
}

/// draws random nonce from [0,...,2**16]
export function idHidingNonce() {
  /// https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
  const array = new Uint16Array(1);
  crypto.getRandomValues(array);
  const randomU16 = array[0];
  return Scalar.fromBigint(BigInt(randomU16));
}

export function noteVersion() {
  // Version is in the form of 0x{note_version}{circuit_version}{patch_version}.
  // So we need to take 3rd byte, we do so by shifting the number by 16 bits to the right.
  return Scalar.fromBigint(BigInt(contractVersion) >> 16n);
}

export function isVersionSupported(version: `0x${string}`) {
  return version === contractVersion;
}

export function getAddressByToken(token: Token): `0x${string}` {
  return token.type === "native" ? nativeTokenAddress : token.address;
}

export function getTokenByAddress(tokenAddress: `0x${string}`): Token {
  return tokenAddress === nativeTokenAddress
    ? nativeToken()
    : erc20Token(tokenAddress);
}
