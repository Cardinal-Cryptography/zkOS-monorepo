import {
  Proof,
  NewAccountValues,
  NewAccountPubInputs
} from "shielder-sdk-crypto";
import { Hasher } from "../hasher";
import { Caller } from "../wasmClient";
import { CircuitBase, WasmModule } from "../utils/wasmModuleLoader";

type NewAccountCircuit =
  | typeof import("shielder-wasm/web-singlethreaded").NewAccountCircuit
  | typeof import("shielder-wasm/web-multithreaded").NewAccountCircuit;

export class NewAccount extends CircuitBase<InstanceType<NewAccountCircuit>> {
  hasher: Hasher;

  constructor(caller: Caller) {
    super(
      caller,
      (wasmModule: WasmModule) => new wasmModule.NewAccountCircuit()
    );
    this.hasher = new Hasher(caller);
  }

  prove(values: NewAccountValues): Proof {
    return this.circuit.prove(
      values.id.bytes,
      values.nullifier.bytes,
      values.trapdoor.bytes,
      values.initialDeposit.bytes
    );
  }

  verify(proof: Proof, pubInputs: NewAccountPubInputs): boolean {
    const time = Date.now();
    try {
      this.circuit.verify(
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
