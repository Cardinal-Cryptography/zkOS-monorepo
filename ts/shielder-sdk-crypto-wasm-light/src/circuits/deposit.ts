import { bytesToObject, objectToBytes } from "@/utils";
import {
  DepositAdvice,
  DepositCircuit,
  DepositPubInputs,
  Proof,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { TeeClient } from "./teeClient";

export class DepositTeeCircuit implements DepositCircuit {
  constructor(private teeClient: TeeClient) {}

  async prove(values: DepositAdvice<Scalar>): Promise<{
    proof: Proof;
    pubInputs: DepositPubInputs<Scalar>;
  }> {
    const witness = {
      id: values.id.bytes,
      nullifier_old: values.nullifierOld.bytes,
      account_balance_old: values.accountBalanceOld.bytes,
      token_address: values.tokenAddress.bytes,
      path: values.path,
      value: values.value.bytes,
      caller_address: values.callerAddress.bytes,
      nullifier_new: values.nullifierNew.bytes,
      mac_salt: values.macSalt.bytes
    };

    const witnessBytes = objectToBytes(witness);
    const { proof, pubInputs: pubInputsBytes } = await this.teeClient.prove(
      "Deposit",
      witnessBytes
    );
    const pubInputsNonScalar = bytesToObject(pubInputsBytes) as {
      merkle_root: Uint8Array;
      h_nullifier_old: Uint8Array;
      h_note_new: Uint8Array;
      value: Uint8Array;
      caller_address: Uint8Array;
      token_address: Uint8Array;
      mac_salt: Uint8Array;
      mac_commitment: Uint8Array;
    };
    return {
      proof,
      pubInputs: {
        merkleRoot: new Scalar(pubInputsNonScalar.merkle_root),
        hNullifierOld: new Scalar(pubInputsNonScalar.h_nullifier_old),
        hNoteNew: new Scalar(pubInputsNonScalar.h_note_new),
        value: new Scalar(pubInputsNonScalar.value),
        callerAddress: new Scalar(pubInputsNonScalar.caller_address),
        tokenAddress: new Scalar(pubInputsNonScalar.token_address),
        macSalt: new Scalar(pubInputsNonScalar.mac_salt),
        macCommitment: new Scalar(pubInputsNonScalar.mac_commitment)
      }
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(proof: Proof, pubInputs: DepositPubInputs<Scalar>): Promise<boolean> {
    return Promise.resolve(true);
  }
}
