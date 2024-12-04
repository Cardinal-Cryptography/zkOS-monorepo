import { relayPath } from "@/constants";
import { Address, Hash } from "viem";

export type WithdrawResponse = {
  tx_hash: Hash;
  block_hash: Hash;
};

export type QuoteFeesResponse = {
  base_fee: string; // decimal string
  relay_fee: string; // decimal string
};

export class VersionRejectedByRelayer extends Error {
  constructor(message: string) {
    super(`Version rejected by relayer: ${message}`);

    Object.setPrototypeOf(this, VersionRejectedByRelayer.prototype);
  }
}

export class GenericWithdrawError extends Error {
  constructor(message: string) {
    super(`Failed to withdraw: ${message}`);

    Object.setPrototypeOf(this, GenericWithdrawError.prototype);
  }
}

export type IRelayer = {
  address: Address;
  withdraw: (
    expectedContractVersion: `0x${string}`,
    idHiding: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawAddress: `0x${string}`
  ) => Promise<WithdrawResponse>;
  quoteFees: () => Promise<QuoteFeesResponse>;
};

export class Relayer implements IRelayer {
  url: string;
  address: Address;

  constructor(url: string, address: Address) {
    this.url = url;
    this.address = address;
  }

  withdraw = async (
    expectedContractVersion: `0x${string}`,
    idHiding: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawAddress: `0x${string}`
  ) => {
    let response;
    try {
      response = await fetch(`${this.url}${relayPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(
          {
            expected_contract_version: expectedContractVersion,
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
    } catch (error) {
      throw new GenericWithdrawError(`${(error as Error).message}`);
    }

    if (!response.ok) {
      const responseText = await response.text();

      if (responseText.startsWith('"Version mismatch:')) {
        throw new VersionRejectedByRelayer(responseText);
      }

      throw new GenericWithdrawError(`${responseText}`);
    }

    return (await response.json()) as WithdrawResponse;
  };

  quoteFees = async () => {
    let response;
    try {
      response = await fetch(`${this.url}${relayPath}`, {
        method: "GET"
      });
    } catch (error) {
      throw new Error(`${(error as Error).message}`);
    }

    if (!response.ok) {
      const responseText = await response.text();

      throw new Error(`${responseText}`);
    }

    return (await response.json()) as QuoteFeesResponse;
  };
}
