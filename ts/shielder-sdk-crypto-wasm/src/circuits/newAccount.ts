import {
  Proof,
  NewAccountAdvice,
  NewAccountPubInputs,
  NewAccountCircuit as INewAccountCircuit,
  Scalar
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

  prove(values: NewAccountAdvice<Scalar>): Promise<Proof> {
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
        values.encryptionSalt.bytes,
        values.anonymityRevokerPublicKeyX.bytes,
        values.anonymityRevokerPublicKeyY.bytes
      )
    );
  }

  async pubInputs(
    values: NewAccountAdvice<Scalar>
  ): Promise<NewAccountPubInputs<Scalar>> {
    if (!this.wasmCircuit) {
      throw new Error("Circuit not initialized");
    }
    if (!this.wasmModule) {
      throw new Error("Wasm module not loaded");
    }
    const pubInputsBytes = this.wasmModule.new_account_pub_inputs(
      values.id.bytes,
      values.nullifier.bytes,
      values.trapdoor.bytes,
      values.initialDeposit.bytes,
      values.tokenAddress.bytes,
      values.encryptionSalt.bytes,
      values.anonymityRevokerPublicKeyX.bytes,
      values.anonymityRevokerPublicKeyY.bytes
    );

    return Promise.resolve({
      hNote: new Scalar(pubInputsBytes.hashed_note),
      hId: new Scalar(pubInputsBytes.hashed_id),
      initialDeposit: new Scalar(pubInputsBytes.initial_deposit),
      tokenAddress: new Scalar(pubInputsBytes.token_address),
      anonymityRevokerPublicKeyX: new Scalar(
        pubInputsBytes.anonymity_revoker_public_key_x
      ),
      anonymityRevokerPublicKeyY: new Scalar(
        pubInputsBytes.anonymity_revoker_public_key_y
      ),
      symKeyEncryption1X: new Scalar(pubInputsBytes.sym_key_encryption_1_x),
      symKeyEncryption1Y: new Scalar(pubInputsBytes.sym_key_encryption_1_y),
      symKeyEncryption2X: new Scalar(pubInputsBytes.sym_key_encryption_2_x),
      symKeyEncryption2Y: new Scalar(pubInputsBytes.sym_key_encryption_2_y)
    });
  }

  async verify(
    proof: Proof,
    pubInputs: NewAccountPubInputs<Scalar>
  ): Promise<boolean> {
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
          pubInputs.anonymityRevokerPublicKeyX.bytes,
          pubInputs.anonymityRevokerPublicKeyY.bytes,
          pubInputs.symKeyEncryption1X.bytes,
          pubInputs.symKeyEncryption1Y.bytes,
          pubInputs.symKeyEncryption2X.bytes,
          pubInputs.symKeyEncryption2Y.bytes,
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
