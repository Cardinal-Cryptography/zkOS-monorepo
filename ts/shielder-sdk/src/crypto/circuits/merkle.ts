import { Proof, Caller } from "@/wasmClient";
import * as singleThreadedWasm from "shielder-wasm/web-singlethreaded";
import * as multiThreadedWasm from "shielder-wasm/web-multithreaded";

export class Merkle {
  merkleCircuit:
    | singleThreadedWasm.MerkleCircuit
    | multiThreadedWasm.MerkleCircuit
    | undefined;
  caller: Caller;

  constructor(caller: Caller) {
    this.caller = caller;
    if (caller == "web_singlethreaded") {
      this.merkleCircuit = new singleThreadedWasm.MerkleCircuit();
    } else if (caller == "web_multithreaded") {
      this.merkleCircuit = new multiThreadedWasm.MerkleCircuit();
    } else {
      throw new Error("Invalid caller");
    }
  }

  prove(): Proof {
    const time = Date.now();
    this.merkleCircuit!.prove();
    console.log(`actual proving ${Date.now() - time}ms`);
    return this.merkleCircuit!.proof();
  }

  verify() {
    const time = Date.now();
    this.merkleCircuit!.verify();
    console.log(`verification ${Date.now() - time}ms`);
  }

  proveAndVerify(): Proof {
    const proof = this.prove();
    this.verify();
    return proof;
  }
}
