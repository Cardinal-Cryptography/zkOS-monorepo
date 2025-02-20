export type NativeToken = {
  type: "native";
};

export type ERC20Token = {
  type: "erc20";
  address: `0x${string}`;
};

export type Token = NativeToken | ERC20Token;

export function nativeToken(): NativeToken {
  return { type: "native" };
}

export function erc20Token(address: `0x${string}`): ERC20Token {
  return { type: "erc20", address };
}
