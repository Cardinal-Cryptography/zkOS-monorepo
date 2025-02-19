import {
  Proof,
  WithdrawPubInputs,
  WithdrawAdvice,
  WithdrawCircuit as IWithdrawCircuit,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "../wasmClient";
import { WasmClientModuleBase } from "../utils/wasmModuleLoader";
import { splitUint8 } from "@/utils";

type WasmWithdrawCircuit =
  | typeof import("shielder_bindings/web-singlethreaded").WithdrawCircuit
  | typeof import("shielder_bindings/web-multithreaded").WithdrawCircuit;

export class WithdrawCircuit
  extends WasmClientModuleBase
  implements IWithdrawCircuit
{
  private wasmCircuit: InstanceType<WasmWithdrawCircuit> | undefined;
  init(caller: Caller) {
    super.init(caller);
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    this.wasmCircuit = new this.wasmModule.WithdrawCircuit();
  }

  prove(values: WithdrawAdvice): Promise<Proof> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    return Promise.resolve(
      this.wasmCircuit.prove(
        values.id.bytes,
        values.nonce.bytes,
        values.nullifierOld.bytes,
        values.trapdoorOld.bytes,
        values.accountBalanceOld.bytes,
        values.tokenAddress.bytes,
        values.path,
        values.value.bytes,
        values.nullifierNew.bytes,
        values.trapdoorNew.bytes,
        values.commitment.bytes,
        values.macSalt.bytes
      )
    );
  }

  async pubInputs(values: WithdrawAdvice): Promise<WithdrawPubInputs> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    const pubInputsBytes = this.wasmModule.withdraw_pub_inputs(
      values.id.bytes,
      values.nonce.bytes,
      values.nullifierOld.bytes,
      values.trapdoorOld.bytes,
      values.accountBalanceOld.bytes,
      values.tokenAddress.bytes,
      values.path,
      values.value.bytes,
      values.nullifierNew.bytes,
      values.trapdoorNew.bytes,
      values.commitment.bytes,
      values.macSalt.bytes
    );

    return Promise.resolve({
      idHiding: new Scalar(pubInputsBytes.id_hiding),
      merkleRoot: new Scalar(pubInputsBytes.merkle_root),
      hNullifierOld: new Scalar(pubInputsBytes.h_nullifier_old),
      hNoteNew: new Scalar(pubInputsBytes.h_note_new),
      value: new Scalar(pubInputsBytes.withdrawal_value),
      commitment: new Scalar(pubInputsBytes.commitment),
      tokenAddress: new Scalar(pubInputsBytes.token_address),
      macSalt: new Scalar(pubInputsBytes.mac_salt),
      macCommitment: new Scalar(pubInputsBytes.mac_commitment)
    });
  }

  async verify(proof: Proof, pubInputs: WithdrawPubInputs): Promise<boolean> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    const time = Date.now();
    try {
      await Promise.resolve(
        this.wasmCircuit.verify(
          pubInputs.idHiding.bytes,
          pubInputs.merkleRoot.bytes,
          pubInputs.hNullifierOld.bytes,
          pubInputs.hNoteNew.bytes,
          pubInputs.value.bytes,
          pubInputs.commitment.bytes,
          pubInputs.tokenAddress.bytes,
          pubInputs.macSalt.bytes,
          pubInputs.macCommitment.bytes,
          proof
        )
      );
    } catch (e) {
      console.log(`verification ${Date.now() - time}ms`);
      console.error(e);
      return false;
    }
    console.log(`verification ${Date.now() - time}ms`);
    return true;
  }
}
