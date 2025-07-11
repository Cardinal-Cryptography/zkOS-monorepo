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
      nullifierOld: values.nullifierOld.bytes,
      accountBalanceOld: values.accountBalanceOld.bytes,
      tokenAddress: values.tokenAddress.bytes,
      path: values.path,
      value: values.value.bytes,
      nullifierNew: values.nullifierNew.bytes,
      commitment: values.commitment.bytes,
      macSalt: values.macSalt.bytes
    };

    const witnessBytes = objectToBytes(witness);
    const { proof, pubInputs: pubInputsBytes } = await this.teeClient.prove(
      4,
      witnessBytes
    );
    const pubInputsNonScalar = bytesToObject(
      pubInputsBytes
    ) as WithdrawPubInputs<Uint8Array>;
    return {
      proof,
      pubInputs: {
        merkleRoot: new Scalar(pubInputsNonScalar.merkleRoot),
        hNullifierOld: new Scalar(pubInputsNonScalar.hNullifierOld),
        hNoteNew: new Scalar(pubInputsNonScalar.hNoteNew),
        value: new Scalar(pubInputsNonScalar.value),
        tokenAddress: new Scalar(pubInputsNonScalar.tokenAddress),
        commitment: new Scalar(pubInputsNonScalar.commitment),
        macSalt: new Scalar(pubInputsNonScalar.macSalt),
        macCommitment: new Scalar(pubInputsNonScalar.macCommitment)
      }
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(proof: Proof, pubInputs: WithdrawPubInputs<Scalar>): Promise<boolean> {
    return Promise.resolve(true);
  }
}
