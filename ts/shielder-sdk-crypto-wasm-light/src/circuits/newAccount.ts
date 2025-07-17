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
      initial_deposit: values.initialDeposit.bytes,
      commitment: values.commitment.bytes,
      token_address: values.tokenAddress.bytes,
      encryption_salt: values.encryptionSalt.bytes,
      mac_salt: values.macSalt.bytes,
      anonymity_revoker_public_key_x: values.anonymityRevokerPublicKeyX.bytes,
      anonymity_revoker_public_key_y: values.anonymityRevokerPublicKeyY.bytes
    };

    const witnessBytes = objectToBytes(witness);
    const { proof, pubInputs: pubInputsBytes } = await this.teeClient.prove(
      "NewAccount",
      witnessBytes
    );
    const pubInputsNonScalar = bytesToObject(pubInputsBytes) as {
      hashed_note: Uint8Array;
      prenullifier: Uint8Array;
      initial_deposit: Uint8Array;
      commitment: Uint8Array;
      token_address: Uint8Array;
      anonymity_revoker_public_key_x: Uint8Array;
      anonymity_revoker_public_key_y: Uint8Array;
      sym_key_encryption_1_x: Uint8Array;
      sym_key_encryption_1_y: Uint8Array;
      sym_key_encryption_2_x: Uint8Array;
      sym_key_encryption_2_y: Uint8Array;
      mac_salt: Uint8Array;
      mac_commitment: Uint8Array;
    };

    const pubInputs: NewAccountPubInputs<Scalar> = {
      hNote: new Scalar(pubInputsNonScalar.hashed_note),
      prenullifier: new Scalar(pubInputsNonScalar.prenullifier),
      initialDeposit: new Scalar(pubInputsNonScalar.initial_deposit),
      commitment: new Scalar(pubInputsNonScalar.commitment),
      tokenAddress: new Scalar(pubInputsNonScalar.token_address),
      anonymityRevokerPublicKeyX: new Scalar(
        pubInputsNonScalar.anonymity_revoker_public_key_x
      ),
      anonymityRevokerPublicKeyY: new Scalar(
        pubInputsNonScalar.anonymity_revoker_public_key_y
      ),
      symKeyEncryption1X: new Scalar(pubInputsNonScalar.sym_key_encryption_1_x),
      symKeyEncryption1Y: new Scalar(pubInputsNonScalar.sym_key_encryption_1_y),
      symKeyEncryption2X: new Scalar(pubInputsNonScalar.sym_key_encryption_2_x),
      symKeyEncryption2Y: new Scalar(pubInputsNonScalar.sym_key_encryption_2_y),
      macSalt: new Scalar(pubInputsNonScalar.mac_salt),
      macCommitment: new Scalar(pubInputsNonScalar.mac_commitment)
    };

    return {
      proof,
      pubInputs
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
