import { Proof, DepositValues, DepositPubInputs } from "shielder-sdk-crypto";
import { Hasher } from "../hasher";
import { Caller } from "../wasmClient";
import { CircuitBase, WasmModule } from "../utils/wasmModuleLoader";
import { DepositCircuit as IDepositCircuit } from "shielder-sdk-crypto";

type WasmDepositCircuit =
  | typeof import("shielder-wasm/web-singlethreaded").DepositCircuit
  | typeof import("shielder-wasm/web-multithreaded").DepositCircuit;

export class DepositCircuit
  extends CircuitBase<InstanceType<WasmDepositCircuit>>
  implements IDepositCircuit
{
  init(caller: Caller) {
    super.init(
      caller,
      (wasmModule: WasmModule) => new wasmModule.DepositCircuit()
    );
  }

  async prove(values: DepositValues): Promise<Proof> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    return this.wasmCircuit.prove(
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

  async verify(proof: Proof, pubInputs: DepositPubInputs): Promise<boolean> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    try {
      this.wasmCircuit.verify(
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
