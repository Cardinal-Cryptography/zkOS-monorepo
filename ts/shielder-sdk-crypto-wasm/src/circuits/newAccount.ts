import {
  Proof,
  NewAccountAdvice,
  NewAccountPubInputs,
  NewAccountCircuit as INewAccountCircuit
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "../wasmClient";
import { WasmClientModuleBase } from "../utils/wasmModuleLoader";

type WasmNewAccountCircuit =
  | typeof import("shielder_bindings/web-singlethreaded").NewAccountCircuit
  | typeof import("shielder_bindings/web-multithreaded").NewAccountCircuit;

export class NewAccountCircuit
  extends WasmClientModuleBase
  implements INewAccountCircuit
{
  private wasmCircuit: InstanceType<WasmNewAccountCircuit> | undefined;
  init(caller: Caller) {
    super.init(caller);
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    this.wasmCircuit = new this.wasmModule.NewAccountCircuit();
  }

  prove(values: NewAccountAdvice): Promise<Proof> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    return Promise.resolve(
      this.wasmCircuit.prove(
        values.id.bytes,
        values.nullifier.bytes,
        values.trapdoor.bytes,
        values.initialDeposit.bytes,
        values.tokenAddress.bytes,
        values.anonymityRevokerPubkey.bytes
      )
    );
  }

  async verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    const time = Date.now();
    try {
      await Promise.resolve(
        this.wasmCircuit.verify(
          pubInputs.hNote.bytes,
          pubInputs.hId.bytes,
          pubInputs.initialDeposit.bytes,
          pubInputs.tokenAddress.bytes,
          pubInputs.anonymityRevokerPubkey.bytes,
          pubInputs.symKeyEncryption.bytes,
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
