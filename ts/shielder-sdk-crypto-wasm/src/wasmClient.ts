import * as singlethreaded_wasm from "shielder-wasm/web-singlethreaded";
import * as multithreaded_wasm from "shielder-wasm/web-multithreaded";
import { NewAccountCircuit } from "@/circuits/newAccount";
import { DepositCircuit } from "@/circuits/deposit";
import { WithdrawCircuit } from "@/circuits/withdraw";
import { Hasher } from "@/hasher";
import { SecretGenerator } from "@/secretGenerator";
import { Converter } from "@/conversion";
import { NoteTreeConfig } from "@/noteTreeConfig";
import { CryptoClient } from "shielder-sdk-crypto";

export type Caller = "web_singlethreaded" | "web_multithreaded";

export class WasmClient implements CryptoClient {
  threads: number | undefined;
  newAccountCircuit: NewAccountCircuit;
  depositCircuit: DepositCircuit;
  withdrawCircuit: WithdrawCircuit;
  hasher: Hasher;
  secretManager: SecretGenerator;
  converter: Converter;
  noteTreeConfig: NoteTreeConfig;
  initialized: boolean = false;

  constructor() {
    this.newAccountCircuit = new NewAccountCircuit();
    this.depositCircuit = new DepositCircuit();
    this.withdrawCircuit = new WithdrawCircuit();
    this.hasher = new Hasher();
    this.secretManager = new SecretGenerator();
    this.converter = new Converter();
    this.noteTreeConfig = new NoteTreeConfig();
  }

  async init(caller: Caller, threads: number): Promise<void> {
    const time = Date.now();
    this.threads = threads;
    if (caller == "web_singlethreaded") {
      await singlethreaded_wasm.default();
    } else if (caller == "web_multithreaded") {
      await multithreaded_wasm.default();
      await multithreaded_wasm.initThreadPool(threads);
    } else {
      throw new Error("Invalid caller");
    }
    this.newAccountCircuit.init(caller);
    this.depositCircuit.init(caller);
    this.withdrawCircuit.init(caller);
    this.hasher.init(caller);
    this.secretManager.init(caller);
    this.converter.init(caller);
    this.noteTreeConfig.init(caller);
    this.initialized = true;
    if (caller == "web_singlethreaded") {
      console.log(`Initialized shielder-wasm in ${Date.now() - time}ms`);
    } else {
      console.log(
        `Initialized shielder-wasm with ${threads} threads in ${Date.now() - time}ms`
      );
    }
  }
}
