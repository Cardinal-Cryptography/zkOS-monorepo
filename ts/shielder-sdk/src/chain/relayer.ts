import { feeAddressPath, feePath, relayPath } from "@/constants";
import { CustomError } from "ts-custom-error";
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

export class VersionRejectedByRelayer extends CustomError {
  public constructor(message: string) {
    super(`Version rejected by relayer: ${message}`);
  }
}

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

  constructor(url: string) {
    this.url = url;
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
  ): Promise<WithdrawResponse> => {
    let response;
    try {
      //amount = 0n; // TODO: remove
      let requestBodyTrimmed = JSON.stringify(
        {
          expected_contract_version: expectedContractVersion,
          id_hiding: idHiding,
          amount,
          withdraw_address: withdrawAddress,
          merkle_root: merkleRoot,
          nullifier_hash: oldNullifierHash,
          new_note: newNote,
          proof: Array.from(proof.slice(0, 10))
        },
        (_, value: unknown) =>
          typeof value === "bigint" ? value.toString() : value
      );
      let requestBody = JSON.stringify(
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
      );
      console.log("Withdraw request body (proof trimmed): " + requestBodyTrimmed);

      response = await fetch(`${this.url}${relayPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: requestBody
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
