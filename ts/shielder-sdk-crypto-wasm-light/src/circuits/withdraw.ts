import {
  WithdrawAdvice,
  WithdrawCircuit,
  WithdrawPubInputs,
  Proof,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";

export class WithdrawTeeCircuit implements WithdrawCircuit {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  prove(values: WithdrawAdvice<Scalar>): Promise<{
    proof: Proof;
    pubInputs: WithdrawPubInputs<Scalar>;
  }> {
    throw new Error("Method not implemented.");
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  verify(proof: Proof, pubInputs: WithdrawPubInputs<Scalar>): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
