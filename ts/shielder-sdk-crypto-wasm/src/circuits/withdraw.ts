import { Proof, WithdrawPubInputs, WithdrawValues } from "shielder-sdk-crypto";
import { Hasher } from "../hasher";
import { Caller } from "../wasmClient";
import { CircuitBase, WasmModule } from "../utils/wasmModuleLoader";

type WithdrawCircuit =
  | typeof import("shielder-wasm/web-singlethreaded").WithdrawCircuit
  | typeof import("shielder-wasm/web-multithreaded").WithdrawCircuit;

export class Withdraw extends CircuitBase<InstanceType<WithdrawCircuit>> {
  hasher: Hasher;

  constructor(caller: Caller) {
    super(caller, (wasmModule: WasmModule) => new wasmModule.WithdrawCircuit());
    this.hasher = new Hasher(caller);
  }

  prove(values: WithdrawValues): Proof {
    return this.circuit.prove(
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
    );
  }

  verify(proof: Proof, pubInputs: WithdrawPubInputs) {
    const time = Date.now();
    try {
      this.circuit.verify(
        pubInputs.idHiding.bytes,
        pubInputs.merkleRoot.bytes,
        pubInputs.hNullifierOld.bytes,
        pubInputs.hNoteNew.bytes,
        pubInputs.value.bytes,
        proof,
        pubInputs.commitment.bytes
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
