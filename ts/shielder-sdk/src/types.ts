export interface NativeToken {
  type: "native";
}

export interface ERC20Token {
  type: "erc20";
  address: `0x${string}`;
}

export type Token = NativeToken | ERC20Token;

export function createNativeToken(): NativeToken {
  return { type: "native" };
}

export function createERC20Token(address: `0x${string}`): ERC20Token {
  return { type: "erc20", address };
}
