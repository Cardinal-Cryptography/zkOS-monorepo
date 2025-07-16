import { bytesToObject, objectToBytes } from "@/utils";
import {
  WithdrawAdvice,
  WithdrawCircuit,
  WithdrawPubInputs,
  Proof,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { TeeClient } from "./teeClient";

export class WithdrawTeeCircuit implements WithdrawCircuit {
  constructor(private teeClient: TeeClient) {}

  async prove(values: WithdrawAdvice<Scalar>): Promise<{
    proof: Proof;
    pubInputs: WithdrawPubInputs<Scalar>;
  }> {
    const witness = {
      id: values.id.bytes,
      nullifier_old: values.nullifierOld.bytes,
      account_balance_old: values.accountBalanceOld.bytes,
      token_address: values.tokenAddress.bytes,
      path: values.path,
      value: values.value.bytes,
      nullifier_new: values.nullifierNew.bytes,
      commitment: values.commitment.bytes,
      mac_salt: values.macSalt.bytes
    };

    const witnessBytes = objectToBytes(witness);
    const { proof, pubInputs: pubInputsBytes } = await this.teeClient.prove(
      "Withdraw",
      witnessBytes
    );
    const pubInputsNonScalar = bytesToObject(pubInputsBytes) as {
      merkle_root: Uint8Array;
      h_nullifier_old: Uint8Array;
      h_note_new: Uint8Array;
      withdrawal_value: Uint8Array;
      token_address: Uint8Array;
      commitment: Uint8Array;
      mac_salt: Uint8Array;
      mac_commitment: Uint8Array;
    };
    return {
      proof,
      pubInputs: {
        merkleRoot: new Scalar(pubInputsNonScalar.merkle_root),
        hNullifierOld: new Scalar(pubInputsNonScalar.h_nullifier_old),
        hNoteNew: new Scalar(pubInputsNonScalar.h_note_new),
        value: new Scalar(pubInputsNonScalar.withdrawal_value),
        tokenAddress: new Scalar(pubInputsNonScalar.token_address),
        commitment: new Scalar(pubInputsNonScalar.commitment),
        macSalt: new Scalar(pubInputsNonScalar.mac_salt),
        macCommitment: new Scalar(pubInputsNonScalar.mac_commitment)
      }
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(proof: Proof, pubInputs: WithdrawPubInputs<Scalar>): Promise<boolean> {
    return Promise.resolve(true);
  }
}
