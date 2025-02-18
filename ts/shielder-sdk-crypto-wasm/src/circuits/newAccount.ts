import {
  Proof,
  NewAccountAdvice,
  NewAccountPubInputs,
  NewAccountCircuit as INewAccountCircuit,
  Scalar
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Caller } from "../wasmClient";
import { WasmClientModuleBase } from "../utils/wasmModuleLoader";
import { splitUint8 } from "@/utils";

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
  async pubInputs(values: NewAccountAdvice): Promise<NewAccountPubInputs> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    const pubInputsBytes = this.wasmCircuit.pub_inputs(
      values.id.bytes,
      values.nullifier.bytes,
      values.trapdoor.bytes,
      values.initialDeposit.bytes,
      values.tokenAddress.bytes,
      values.anonymityRevokerPubkey.bytes
    );
    const pubInputs = splitUint8(pubInputsBytes, 32).map(
      (bytes) => new Scalar(bytes)
    );

    return Promise.resolve({
      hNote: pubInputs[0],
      hId: pubInputs[1],
      initialDeposit: pubInputs[2],
      tokenAddress: pubInputs[3],
      anonymityRevokerPubkey: pubInputs[4],
      symKeyEncryption: pubInputs[5]
    });
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
