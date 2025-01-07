import {
  Proof,
  NewAccountValues,
  NewAccountPubInputs
} from "shielder-sdk-crypto";
import { Hasher } from "../hasher";
import { Caller } from "../wasmClient";
import { CircuitBase, WasmModule } from "../utils/wasmModuleLoader";
import { NewAccountCircuit as INewAccountCircuit } from "shielder-sdk-crypto";

type WasmNewAccountCircuit =
  | typeof import("shielder-wasm/web-singlethreaded").NewAccountCircuit
  | typeof import("shielder-wasm/web-multithreaded").NewAccountCircuit;

export class NewAccountCircuit
  extends CircuitBase<InstanceType<WasmNewAccountCircuit>>
  implements INewAccountCircuit
{
  init(caller: Caller) {
    super.init(
      caller,
      (wasmModule: WasmModule) => new wasmModule.NewAccountCircuit()
    );
  }

  async prove(values: NewAccountValues): Promise<Proof> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    return this.wasmCircuit.prove(
      values.id.bytes,
      values.nullifier.bytes,
      values.trapdoor.bytes,
      values.initialDeposit.bytes
    );
  }

  async verify(proof: Proof, pubInputs: NewAccountPubInputs): Promise<boolean> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    const time = Date.now();
    try {
      this.wasmCircuit.verify(
        pubInputs.hNote.bytes,
        pubInputs.hId.bytes,
        pubInputs.initialDeposit.bytes,
        proof
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
