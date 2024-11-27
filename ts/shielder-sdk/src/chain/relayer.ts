import { relayPath } from "@/constants";
import { Address, Hash } from "viem";

export type WithdrawResponse = {
  tx_hash: Hash;
  block_hash: Hash;
};

export type IRelayer = {
  address: Address;
  withdraw: (
    idHiding: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawAddress: `0x${string}`
  ) => Promise<WithdrawResponse>;
};

export class Relayer implements IRelayer {
  url: string;
  address: Address;

  constructor(url: string, address: Address) {
    this.url = url;
    this.address = address;
  }

  withdraw = async (
    idHiding: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawAddress: `0x${string}`
  ) => {
    try {
      const response = await fetch(`${this.url}${relayPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          {
            id_hiding: idHiding,
            amount,
            withdraw_address: withdrawAddress,
            merkle_root: merkleRoot,
            nullifier_hash: oldNullifierHash,
            new_note: newNote,
            proof: Array.from(proof)
          },
          (_, value: unknown) =>
            typeof value === "bigint" ? value.toString() : value
        )
      });
      if (!response.ok) {
        throw new Error(`${await response.text()}`);
      }
      return (await response.json()) as WithdrawResponse;
    } catch (error) {
      throw new Error(`Failed to withdraw: ${(error as Error).message}`);
    }
  };
}
