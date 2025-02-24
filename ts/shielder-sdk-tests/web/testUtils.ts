/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { Token } from "@cardinal-cryptography/shielder-sdk";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function envThreadsNumber(): number {
  const threads = (import.meta as any).env.VITE_PUBLIC_THREADS as
    | string
    | undefined;

  if (!threads || threads === "max") {
    return navigator.hardwareConcurrency;
  } else {
    return parseInt(threads);
  }
}

export function tokenToKey(token: Token) {
  return token.type === "native" ? "native" : token.address;
}

export function keyToToken(key: "native" | `0x${string}`): Token {
  return key === "native"
    ? window.shielder.nativeToken()
    : window.shielder.erc20Token(key);
}
