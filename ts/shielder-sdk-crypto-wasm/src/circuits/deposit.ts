import { Proof, DepositValues, DepositPubInputs } from "shielder-sdk-crypto";
import { Hasher } from "../hasher";
import { Caller } from "../wasmClient";
import { CircuitBase, WasmModule } from "../utils/wasmModuleLoader";

type DepositCircuit =
  | typeof import("shielder-wasm/web-singlethreaded").DepositCircuit
  | typeof import("shielder-wasm/web-multithreaded").DepositCircuit;

export class Deposit extends CircuitBase<InstanceType<DepositCircuit>> {
  hasher: Hasher;

  constructor(caller: Caller) {
    super(caller, (wasmModule: WasmModule) => new wasmModule.DepositCircuit());
    this.hasher = new Hasher(caller);
  }

  prove(values: DepositValues): Proof {
    return this.circuit.prove(
      values.id.bytes,
      values.nonce.bytes,
      values.nullifierOld.bytes,
      values.trapdoorOld.bytes,
      values.accountBalanceOld.bytes,
      values.path,
      values.value.bytes,
      values.nullifierNew.bytes,
      values.trapdoorNew.bytes
    );
  }

  verify(proof: Proof, pubInputs: DepositPubInputs) {
    try {
      this.circuit.verify(
        pubInputs.idHiding.bytes,
        pubInputs.merkleRoot.bytes,
        pubInputs.hNullifierOld.bytes,
        pubInputs.hNoteNew.bytes,
        pubInputs.value.bytes,
        proof
      );
    } catch (e) {
      console.error(e);
      return false;
    }
    return true;
  }
}
