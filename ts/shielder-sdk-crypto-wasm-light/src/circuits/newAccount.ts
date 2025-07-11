import {
  NewAccountAdvice,
  NewAccountCircuit,
  NewAccountPubInputs,
  Proof,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";

export class NewAccountTeeCircuit implements NewAccountCircuit {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  prove(values: NewAccountAdvice<Scalar>): Promise<{
    proof: Proof;
    pubInputs: NewAccountPubInputs<Scalar>;
  }> {
    throw new Error("Method not implemented.");
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(
    proof: Proof,
    pubInputs: NewAccountPubInputs<Scalar>
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
