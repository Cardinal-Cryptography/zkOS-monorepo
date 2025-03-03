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
    new_account_params_buf: Uint8Array,
    new_account_pk_buf: Uint8Array,
    deposit_params_buf: Uint8Array,
    deposit_pk_buf: Uint8Array,
    withdraw_params_buf: Uint8Array,
    withdraw_pk_buf: Uint8Array,
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
    this.newAccountCircuit.init(
      caller,
      new_account_params_buf,
      new_account_pk_buf
    );
    this.depositCircuit.init(caller, deposit_params_buf, deposit_pk_buf);
    this.withdrawCircuit.init(caller, withdraw_params_buf, withdraw_pk_buf);
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
