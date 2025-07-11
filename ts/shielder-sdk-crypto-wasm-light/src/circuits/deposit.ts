import {
  DepositAdvice,
  DepositCircuit,
  DepositPubInputs,
  Proof,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";

export class DepositTeeCircuit implements DepositCircuit {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  prove(values: DepositAdvice<Scalar>): Promise<{
    proof: Proof;
    pubInputs: DepositPubInputs<Scalar>;
  }> {
    throw new Error("Method not implemented.");
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(proof: Proof, pubInputs: DepositPubInputs<Scalar>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
