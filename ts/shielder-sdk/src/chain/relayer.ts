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
  // 8< ----------------------- >8
  base_fee: z.coerce.bigint(),
  relay_fee: z.coerce.bigint(),
  total_fee: z.coerce.bigint(),
  // 8< ----------------------- >8
  total_cost_native: z.coerce.bigint(),
  total_cost_fee_token: z.coerce.bigint(),
  gas_price: z.coerce.bigint(),
  gas_cost_native: z.coerce.bigint(),
  gas_cost_fee_token: z.coerce.bigint(),
  commission_native: z.coerce.bigint(),
  commission_fee_token: z.coerce.bigint(),
  native_token_price: z.coerce.string(),
  native_token_unit_price: z.coerce.string(),
  fee_token_price: z.coerce.string(),
  fee_token_unit_price: z.coerce.string(),
  token_price_ratio: z.coerce.string()
});

export type QuotedFees = z.infer<typeof quoteFeesResponseSchema>;

export const quotedFeesFromTotalFee = (totalFee: bigint) => {
  return {
    base_fee: 0n,
    relay_fee: 0n,
    total_fee: totalFee,
    total_cost_native: totalFee,
    total_cost_fee_token: 0n,
    gas_price: 0n,
    gas_cost_native: 0n,
    gas_cost_fee_token: 0n,
    commission_native: 0n,
    commission_fee_token: 0n,
    native_token_price: "1",
    native_token_unit_price: "1",
    fee_token_price: "1",
    fee_token_unit_price: "1",
    token_price_ratio: "1"
  };
};

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
    feeAmount: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawalAddress: `0x${string}`,
    macSalt: bigint,
    macCommitment: bigint,
    pocketMoney: bigint,
    quotedFees: QuotedFees
  ) => Promise<WithdrawResponse>;
  quoteFees: () => Promise<QuotedFees>;
};

export class Relayer implements IRelayer {
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  withdraw = async (
    expectedContractVersion: `0x${string}`,
    token: Token,
    feeAmount: bigint,
    oldNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array,
    withdrawalAddress: `0x${string}`,
    macSalt: bigint,
    macCommitment: bigint,
    pocketMoney: bigint,
    quotedFees: QuotedFees
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
            calldata: {
              expected_contract_version: expectedContractVersion,
              amount,
              withdraw_address: withdrawalAddress,
              merkle_root: merkleRoot,
              nullifier_hash: oldNullifierHash,
              new_note: newNote,
              mac_salt: macSalt,
              mac_commitment: macCommitment,
              fee_token:
                token.type === "native" ? "Native" : { ERC20: token.address },
              fee_amount: feeAmount,
              proof: Array.from(proof),
              pocket_money: pocketMoney
            },
            quote: {
              gas_price: quotedFees.gas_price,
              native_token_price: quotedFees.native_token_price,
              token_price_ratio: quotedFees.token_price_ratio
            }
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
        throw new OutdatedSdkError(
          `Version rejected by relayer: ${responseText}`
        );
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
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fee_token: "Native",
          pocket_money: "0"
        })
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
