import { IContract } from "@/chain/contract";
import {
  AsymPublicKey,
  CryptoClient,
  NewAccountPubInputs,
  Proof,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { SendShielderTransaction } from "@/client";
import { NoteAction } from "@/actions/utils";
import { AccountState } from "@/state";
import { hexToBigInt } from "viem";

export interface NewAccountCalldata {
  calldata: {
    pubInputs: NewAccountPubInputs;
    proof: Proof;
  };
  expectedContractVersion: `0x${string}`;
  provingTimeMillis: number;
  amount: bigint;
}

export class NewAccountAction extends NoteAction {
  contract: IContract;

  constructor(contract: IContract, cryptoClient: CryptoClient) {
    super(cryptoClient);
    this.contract = contract;
  }

  /**
   * Return the updated state after creating a new account with an initial deposit.
   * Does not perform the actual account creation on blockchain.
   * @param stateOld
   * @param amount initial deposit
   * @returns updated state
   */
  async rawNewAccount(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await this.rawAction(
      stateOld,
      amount,
      (currentBalance: bigint, amount: bigint) => amount
    );
  }

  async preparePubInputs(
    state: AccountState,
    amount: bigint,
    anonymityRevokerPubkey: AsymPublicKey<bigint>
  ): Promise<NewAccountPubInputs> {
    const hId = await this.cryptoClient.hasher.poseidonHash([state.id]);
    const newState = await this.rawNewAccount(state, amount);

    if (newState === null) {
      throw new Error(
        "Failed to create new account, possibly due to negative balance"
      );
    }
    const hNote = newState.currentNote;

    // temporary placeholder for derivation & encryption, will be exposed through bindings in the future
    const encryption = await (async (id: Scalar) => {
      const derivationSalt = Scalar.fromBigint(
        hexToBigInt("0x6b657920666f72204152")
      );
      return await this.cryptoClient.hasher.poseidonHash([id, derivationSalt]);
    })(state.id);
    return {
      hId,
      hNote,
      initialDeposit: Scalar.fromBigint(amount),
      anonymityRevokerPubkey: {
        x: Scalar.fromBigint(anonymityRevokerPubkey.x),
        y: Scalar.fromBigint(anonymityRevokerPubkey.y)
      },
      symKeyEncryption: encryption
    };
  }

  /**
   * Generate calldata for creation of a new account with an initial deposit.
   * @param state current account state
   * @param amount initial deposit
   * @returns calldata for new account action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint,
    expectedContractVersion: `0x${string}`
  ): Promise<NewAccountCalldata> {
    const { nullifier, trapdoor } =
      await this.cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce)
      );
    const anonymityRevokerPubkey = await this.contract.anonymityRevokerPubkey();
    const time = Date.now();
    const proof = await this.cryptoClient.newAccountCircuit
      .prove({
        id: state.id,
        nullifier,
        trapdoor,
        initialDeposit: Scalar.fromBigint(amount),
        anonymityRevokerPubkey: {
          x: Scalar.fromBigint(anonymityRevokerPubkey.x),
          y: Scalar.fromBigint(anonymityRevokerPubkey.y)
        }
      })
      .catch((e) => {
        throw new Error(`Failed to prove new account: ${e}`);
      });
    const pubInputs = await this.preparePubInputs(
      state,
      amount,
      anonymityRevokerPubkey
    );
    if (!(await this.cryptoClient.newAccountCircuit.verify(proof, pubInputs))) {
      throw new Error("New account proof verification failed");
    }
    const provingTime = Date.now() - time;
    return {
      expectedContractVersion,
      calldata: {
        pubInputs,
        proof
      },
      provingTimeMillis: provingTime,
      amount
    };
  }

  /**
   * Create a new account with an initial deposit.
   * Calls the contract through RPC endpoint to create the account on the blockchain.
   * @param calldata calldata for new account action
   * @param sendShielderTransaction function to send the transaction to the blockchain
   * @returns transaction hash of the new account transaction
   */
  async sendCalldata(
    calldata: NewAccountCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      expectedContractVersion,
      amount
    } = calldata;
    const encodedCalldata = await this.contract.newAccountCalldata(
      expectedContractVersion,
      from,
      scalarToBigint(pubInputs.hNote),
      scalarToBigint(pubInputs.hId),
      amount,
      scalarToBigint(pubInputs.symKeyEncryption),
      proof
    );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata,
      to: this.contract.getAddress(),
      value: amount
    }).catch((e) => {
      throw new Error(`Failed to create new account: ${e}`);
    });
    return txHash;
  }
}
