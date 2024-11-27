import { Proof, Caller } from "@/wasmClient";
import { Scalar } from "@/crypto/scalar";
import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";
import { Hasher } from "@/crypto/hasher";
import { noteVersion } from "@/utils";

interface PubInputs {
  hNote: Scalar;
  hId: Scalar;
  initialDeposit: Scalar;
}

export interface NewAccountReturn {
  proof: Proof;
  pubInputs: PubInputs;
}

export interface NewAccountValues {
  id: Scalar;
  nullifier: Scalar;
  trapdoor: Scalar;
  initialDeposit: Scalar;
}

export class NewAccount {
  newAccountCircuit:
    | singleThreadedWasm.NewAccountCircuit
    | multiThreadedWasm.NewAccountCircuit
    | undefined;
  caller: Caller;
  hasher: Hasher;

  constructor(caller: Caller) {
    this.caller = caller;
    if (caller == "web_singlethreaded") {
      this.newAccountCircuit = new singleThreadedWasm.NewAccountCircuit();
    } else if (caller == "web_multithreaded") {
      this.newAccountCircuit = new multiThreadedWasm.NewAccountCircuit();
    } else {
      throw new Error("Invalid caller");
    }
    this.hasher = new Hasher(caller);
  }

  #prepareValues(values: NewAccountValues) {
    const hAcc = this.hasher.poseidonHash([values.initialDeposit]);
    const hId = this.hasher.poseidonHash([values.id]);
    const version = noteVersion();
    const hNote = this.hasher.poseidonHash([
      version,
      values.id,
      values.nullifier,
      values.trapdoor,
      hAcc
    ]);
    return { hId, hNote };
  }

  prove(values: NewAccountValues): NewAccountReturn {
    let time = Date.now();
    const { hId, hNote } = this.#prepareValues(values);
    console.log(`witness preparation ${Date.now() - time}ms`);

    time = Date.now();
    const proof = this.newAccountCircuit!.prove(
      values.id.bytes,
      values.nullifier.bytes,
      values.trapdoor.bytes,
      values.initialDeposit.bytes
    );
    console.log(`actual proving ${Date.now() - time}ms`);

    const pubInputs = {
      hNote: hNote,
      hId: hId,
      initialDeposit: values.initialDeposit
    };

    return {
      proof,
      pubInputs
    };
  }

  verify(proof: Proof, pubInputs: PubInputs): void {
    const time = Date.now();
    this.newAccountCircuit!.verify(
      pubInputs.hNote.bytes,
      pubInputs.hId.bytes,
      pubInputs.initialDeposit.bytes,
      proof
    );
    console.log(`verification ${Date.now() - time}ms`);
  }

  proveAndVerify(values: NewAccountValues): NewAccountReturn {
    const result = this.prove(values);
    this.verify(result.proof, result.pubInputs);
    return result;
  }
}
