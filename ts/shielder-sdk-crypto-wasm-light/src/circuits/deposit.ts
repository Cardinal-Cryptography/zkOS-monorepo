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
      nullifierOld: values.nullifierOld.bytes,
      accountBalanceOld: values.accountBalanceOld.bytes,
      tokenAddress: values.tokenAddress.bytes,
      path: values.path,
      value: values.value.bytes,
      callerAddress: values.callerAddress.bytes,
      nullifierNew: values.nullifierNew.bytes,
      macSalt: values.macSalt.bytes
    };

    const witnessBytes = objectToBytes(witness);
    const { proof, pubInputs: pubInputsBytes } = await this.teeClient.prove(
      2,
      witnessBytes
    );
    const pubInputsNonScalar = bytesToObject(
      pubInputsBytes
    ) as DepositPubInputs<Uint8Array>;
    return {
      proof,
      pubInputs: {
        merkleRoot: new Scalar(pubInputsNonScalar.merkleRoot),
        hNullifierOld: new Scalar(pubInputsNonScalar.hNullifierOld),
        hNoteNew: new Scalar(pubInputsNonScalar.hNoteNew),
        value: new Scalar(pubInputsNonScalar.value),
        callerAddress: new Scalar(pubInputsNonScalar.callerAddress),
        tokenAddress: new Scalar(pubInputsNonScalar.tokenAddress),
        macSalt: new Scalar(pubInputsNonScalar.macSalt),
        macCommitment: new Scalar(pubInputsNonScalar.macCommitment)
      }
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(proof: Proof, pubInputs: DepositPubInputs<Scalar>): Promise<boolean> {
    return Promise.resolve(true);
  }
}
