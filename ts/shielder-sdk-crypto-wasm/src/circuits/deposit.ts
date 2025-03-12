import {
  Proof,
  DepositAdvice,
  DepositPubInputs,
  DepositCircuit as IDepositCircuit,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "../wasmClient";
import { WasmClientModuleBase } from "../utils/wasmModuleLoader";
import { CircuitParamsPkBuffer } from "@/types";

type WasmDepositCircuit =
  | typeof import("shielder_bindings/web-singlethreaded").DepositCircuit
  | typeof import("shielder_bindings/web-multithreaded").DepositCircuit;

export class DepositCircuit
  extends WasmClientModuleBase
  implements IDepositCircuit
{
  private wasmCircuit: InstanceType<WasmDepositCircuit> | undefined;
  init(caller: Caller, buf: CircuitParamsPkBuffer) {
    super.init(caller);
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    this.wasmCircuit = new this.wasmModule.DepositCircuit(
      buf.paramsBuf,
      buf.pkBuf
    );
  }

  prove(values: DepositAdvice<Scalar>): Promise<Proof> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    return Promise.resolve(
      this.wasmCircuit.prove(
        values.id.bytes,
        values.nullifierOld.bytes,
        values.trapdoorOld.bytes,
        values.accountBalanceOld.bytes,
        values.tokenAddress.bytes,
        values.path,
        values.value.bytes,
        values.nullifierNew.bytes,
        values.trapdoorNew.bytes,
        values.macSalt.bytes
      )
    );
  }

  async pubInputs(
    values: DepositAdvice<Scalar>
  ): Promise<DepositPubInputs<Scalar>> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    const pubInputsBytes = this.wasmModule.deposit_pub_inputs(
      values.id.bytes,
      values.nullifierOld.bytes,
      values.trapdoorOld.bytes,
      values.accountBalanceOld.bytes,
      values.tokenAddress.bytes,
      values.path,
      values.value.bytes,
      values.nullifierNew.bytes,
      values.trapdoorNew.bytes,
      values.macSalt.bytes
    );
    return Promise.resolve({
      merkleRoot: new Scalar(pubInputsBytes.merkle_root),
      hNullifierOld: new Scalar(pubInputsBytes.h_nullifier_old),
      hNoteNew: new Scalar(pubInputsBytes.h_note_new),
      value: new Scalar(pubInputsBytes.value),
      tokenAddress: new Scalar(pubInputsBytes.token_address),
      macSalt: new Scalar(pubInputsBytes.mac_salt),
      macCommitment: new Scalar(pubInputsBytes.mac_commitment)
    });
  }

  async verify(
    proof: Proof,
    pubInputs: DepositPubInputs<Scalar>
  ): Promise<boolean> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    try {
      await Promise.resolve(
        this.wasmCircuit.verify(
          pubInputs.merkleRoot.bytes,
          pubInputs.hNullifierOld.bytes,
          pubInputs.hNoteNew.bytes,
          pubInputs.value.bytes,
          pubInputs.tokenAddress.bytes,
          pubInputs.macSalt.bytes,
          pubInputs.macCommitment.bytes,
          proof
        )
      );
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }
}
