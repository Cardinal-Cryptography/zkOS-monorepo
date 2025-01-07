import { Proof, WithdrawPubInputs, WithdrawValues } from "shielder-sdk-crypto";
import { Hasher } from "../hasher";
import { Caller } from "../wasmClient";
import { CircuitBase, WasmModule } from "../utils/wasmModuleLoader";
import { WithdrawCircuit as IWithdrawCircuit } from "shielder-sdk-crypto";

type WasmWithdrawCircuit =
  | typeof import("shielder-wasm/web-singlethreaded").WithdrawCircuit
  | typeof import("shielder-wasm/web-multithreaded").WithdrawCircuit;

export class WithdrawCircuit
  extends CircuitBase<InstanceType<WasmWithdrawCircuit>>
  implements IWithdrawCircuit
{
  init(caller: Caller) {
    super.init(
      caller,
      (wasmModule: WasmModule) => new wasmModule.WithdrawCircuit()
    );
  }

  async prove(values: WithdrawValues): Promise<Proof> {
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
      values.trapdoorNew.bytes,
      values.commitment.bytes
    );
  }

  async verify(proof: Proof, pubInputs: WithdrawPubInputs): Promise<boolean> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    const time = Date.now();
    try {
      this.wasmCircuit.verify(
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
