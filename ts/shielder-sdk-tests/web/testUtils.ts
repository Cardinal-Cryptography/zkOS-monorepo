/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { Token } from "@cardinal-cryptography/shielder-sdk";

export function tokenToKey(token: Token) {
  return token.type === "native"
    ? "native"
    : (token.address.toLowerCase() as `0x${string}`);
}

export function keyToToken(key: "native" | `0x${string}`): Token {
  return key === "native"
    ? window.shielder.nativeToken()
    : window.shielder.erc20Token(key);
}
