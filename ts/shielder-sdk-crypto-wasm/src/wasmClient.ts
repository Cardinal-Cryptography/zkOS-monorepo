import * as singlethreaded_wasm from "shielder_bindings/web-singlethreaded";
import * as multithreaded_wasm from "shielder_bindings/web-multithreaded";
import { NewAccountCircuit } from "@/circuits/newAccount";
import { DepositCircuit } from "@/circuits/deposit";
import { WithdrawCircuit } from "@/circuits/withdraw";
import { Hasher } from "@/hasher";
import { SecretGenerator } from "@/secretGenerator";
import { NoteTreeConfig } from "@/noteTreeConfig";
import { CryptoClient } from "@cardinal-cryptography/shielder-sdk-crypto";
import { Converter } from "@/conversion";
import { CircuitParamsPkBuffer } from "./types";

export type Caller = "web_singlethreaded" | "web_multithreaded";

export class WasmClient implements CryptoClient {
  threads: number | undefined;
  newAccountCircuit: NewAccountCircuit;
  depositCircuit: DepositCircuit;
  withdrawCircuit: WithdrawCircuit;
  hasher: Hasher;
  secretManager: SecretGenerator;
  noteTreeConfig: NoteTreeConfig;
  converter: Converter;
  initialized: boolean = false;

  constructor() {
    this.newAccountCircuit = new NewAccountCircuit();
    this.depositCircuit = new DepositCircuit();
    this.withdrawCircuit = new WithdrawCircuit();
    this.hasher = new Hasher();
    this.secretManager = new SecretGenerator();
    this.noteTreeConfig = new NoteTreeConfig();
    this.converter = new Converter();
  }

  async init(
    caller: Caller,
    threads: number,
    newAccountBuf: CircuitParamsPkBuffer,
    depositBuf: CircuitParamsPkBuffer,
    withdrawBuf: CircuitParamsPkBuffer,
    wasm_url?: string
  ): Promise<void> {
    const time = Date.now();
    this.threads = threads;
    if (caller == "web_singlethreaded") {
      await singlethreaded_wasm.default(wasm_url);
    } else if (caller == "web_multithreaded") {
      await multithreaded_wasm.default(wasm_url);
      await multithreaded_wasm.initThreadPool(threads);
    } else {
      throw new Error("Invalid caller");
    }
    this.newAccountCircuit.init(caller, newAccountBuf);
    this.depositCircuit.init(caller, depositBuf);
    this.withdrawCircuit.init(caller, withdrawBuf);
    this.hasher.init(caller);
    this.secretManager.init(caller);
    this.noteTreeConfig.init(caller);
    this.converter.init(caller);
    this.initialized = true;
    if (caller == "web_singlethreaded") {
      console.log(`Initialized shielder_bindings in ${Date.now() - time}ms`);
    } else {
      console.log(
        `Initialized shielder_bindings with ${threads} threads in ${Date.now() - time}ms`
      );
    }
  }
}
