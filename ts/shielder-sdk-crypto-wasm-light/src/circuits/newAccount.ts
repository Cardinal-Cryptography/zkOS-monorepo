import { bytesToObject, objectToBytes } from "@/utils";
import {
  NewAccountAdvice,
  NewAccountCircuit,
  NewAccountPubInputs,
  Proof,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { TeeClient } from "./teeClient";

export class NewAccountTeeCircuit implements NewAccountCircuit {
  constructor(private teeClient: TeeClient) {}

  async prove(values: NewAccountAdvice<Scalar>): Promise<{
    proof: Proof;
    pubInputs: NewAccountPubInputs<Scalar>;
  }> {
    const witness = {
      id: values.id.bytes,
      nullifier: values.nullifier.bytes,
      initialDeposit: values.initialDeposit.bytes,
      callerAddress: values.callerAddress.bytes,
      tokenAddress: values.tokenAddress.bytes,
      encryptionSalt: values.encryptionSalt.bytes,
      macSalt: values.macSalt.bytes,
      anonymityRevokerPublicKeyX: values.anonymityRevokerPublicKeyX.bytes,
      anonymityRevokerPublicKeyY: values.anonymityRevokerPublicKeyY.bytes
    };

    const witnessBytes = objectToBytes(witness);
    const { proof, pubInputs: pubInputsBytes } = await this.teeClient.prove(
      1,
      witnessBytes
    );
    const pubInputsNonScalar = bytesToObject(
      pubInputsBytes
    ) as NewAccountPubInputs<Uint8Array>;
    return {
      proof,
      pubInputs: {
        hNote: new Scalar(pubInputsNonScalar.hNote),
        prenullifier: new Scalar(pubInputsNonScalar.prenullifier),
        initialDeposit: new Scalar(pubInputsNonScalar.initialDeposit),
        callerAddress: new Scalar(pubInputsNonScalar.callerAddress),
        tokenAddress: new Scalar(pubInputsNonScalar.tokenAddress),
        anonymityRevokerPublicKeyX: new Scalar(
          pubInputsNonScalar.anonymityRevokerPublicKeyX
        ),
        anonymityRevokerPublicKeyY: new Scalar(
          pubInputsNonScalar.anonymityRevokerPublicKeyY
        ),
        symKeyEncryption1X: new Scalar(pubInputsNonScalar.symKeyEncryption1X),
        symKeyEncryption1Y: new Scalar(pubInputsNonScalar.symKeyEncryption1Y),
        symKeyEncryption2X: new Scalar(pubInputsNonScalar.symKeyEncryption2X),
        symKeyEncryption2Y: new Scalar(pubInputsNonScalar.symKeyEncryption2Y),
        macSalt: new Scalar(pubInputsNonScalar.macSalt),
        macCommitment: new Scalar(pubInputsNonScalar.macCommitment)
      }
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(
    proof: Proof,
    pubInputs: NewAccountPubInputs<Scalar>
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
}
