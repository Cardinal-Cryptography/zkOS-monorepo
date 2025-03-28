export type NativeToken = {
  type: "native";
};

export type ERC20Token = {
  type: "erc20";
  address: `0x${string}`;
  decimals: number;
};

export type Token = NativeToken | ERC20Token;
