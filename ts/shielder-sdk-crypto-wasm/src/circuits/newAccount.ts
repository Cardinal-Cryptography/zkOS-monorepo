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
        values.anonymityRevokerPubkey.x.bytes,
        values.anonymityRevokerPubkey.y.bytes
      )
    );
  }
  async pubInputs(values: NewAccountAdvice): Promise<NewAccountPubInputs> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    const pubInputsBridged = this.wasmModule.new_account_pub_inputs(
      values.id.bytes,
      values.nullifier.bytes,
      values.trapdoor.bytes,
      values.initialDeposit.bytes,
      values.tokenAddress.bytes,
      values.anonymityRevokerPubkey.bytes
    );

    return Promise.resolve({
      hNote: new Scalar(pubInputsBridged.hashed_note),
      hId: new Scalar(pubInputsBridged.hashed_id),
      initialDeposit: new Scalar(pubInputsBridged.initial_deposit),
      tokenAddress: new Scalar(pubInputsBridged.token_address),
      anonymityRevokerPubkey: new Scalar(
        pubInputsBridged.anonymity_revoker_public_key
      ),
      symKeyEncryption: new Scalar(pubInputsBridged.sym_key_encryption)
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
          pubInputs.anonymityRevokerPubkey.x.bytes,
          pubInputs.anonymityRevokerPubkey.y.bytes,
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
