import { feeAddressPath, feePath, relayPath } from "@/constants";
import { OutdatedSdkError } from "@/errors";
import { Token } from "@/types";
import { Address } from "viem";
import { z } from "zod";

const withdrawResponseSchema = z.object({
  tx_hash: z.string().regex(/^0x([A-Fa-f0-9]{64})$/)
});

export type WithdrawResponse = z.infer<typeof withdrawResponseSchema>;

const quoteFeesResponseSchema = z.object({
  base_fee: z.coerce.bigint(),
  relay_fee: z.coerce.bigint(),
  total_fee: z.coerce.bigint()
});

export type QuoteFeesResponse = z.infer<typeof quoteFeesResponseSchema>;

export class GenericWithdrawError extends Error {
  constructor(message: string) {
    super(`Failed to withdraw: ${message}`);

    Object.setPrototypeOf(this, GenericWithdrawError.prototype);
  }
}

export type IRelayer = {
  address: () => Promise<Address>;
  withdraw: (
    expectedContractVersion: `0x${string}`,
    token: Token,
    idHiding: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawalAddress: `0x${string}`,
    macSalt: bigint,
    macCommitment: bigint
  ) => Promise<WithdrawResponse>;
  quoteFees: () => Promise<QuoteFeesResponse>;
};

export class Relayer implements IRelayer {
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  withdraw = async (
    expectedContractVersion: `0x${string}`,
    token: Token,
    idHiding: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawalAddress: `0x${string}`,
    macSalt: bigint,
    macCommitment: bigint
  ): Promise<WithdrawResponse> => {
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
            withdraw_address: withdrawalAddress,
            merkle_root: merkleRoot,
            nullifier_hash: oldNullifierHash,
            new_note: newNote,
            mac_salt: macSalt,
            mac_commitment: macCommitment,
            fee_token:
              token.type === "native"
                ? "Native"
                : {
                    ERC20: token.address
                  },
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
        throw new OutdatedSdkError(responseText);
      }

      throw new GenericWithdrawError(`${responseText}`);
    }

    try {
      return withdrawResponseSchema.parse(await response.json());
    } catch (error) {
      throw new GenericWithdrawError(`${(error as Error).message}`);
    }
  };

  quoteFees = async () => {
    let response;
    try {
      response = await fetch(`${this.url}${feePath}`, {
        method: "GET"
      });
    } catch (error) {
      throw new Error(`${(error as Error).message}`);
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`${responseText}`);
    }

    return quoteFeesResponseSchema.parse(await response.json());
  };

  address = async () => {
    let response;
    try {
      response = await fetch(`${this.url}${feeAddressPath}`, {
        method: "GET"
      });
    } catch (error) {
      throw new Error(`${(error as Error).message}`);
    }

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`${responseText}`);
    }

    return (await response.text()) as `0x${string}`;
  };
}
