import {
  Proof,
  WithdrawPubInputs,
  WithdrawAdvice,
  WithdrawCircuit as IWithdrawCircuit
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "../wasmClient";
import { WasmClientModuleBase } from "../utils/wasmModuleLoader";

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
        values.path,
        values.value.bytes,
        values.nullifierNew.bytes,
        values.trapdoorNew.bytes,
        values.commitment.bytes
      )
    );
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
          proof,
          pubInputs.commitment.bytes
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
