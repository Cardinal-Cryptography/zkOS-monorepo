import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  NewAccountAdvice,
  NewAccountPubInputs,
  Proof,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { SendShielderTransaction } from "@/client";
import { NoteAction } from "@/actions/utils";
import { AccountState } from "@/state";
import { Token } from "@/types";
import { getTokenAddress } from "@/utils";

export interface NewAccountCalldata {
  calldata: {
    pubInputs: NewAccountPubInputs;
    proof: Proof;
  };
  expectedContractVersion: `0x${string}`;
  provingTimeMillis: number;
  amount: bigint;
  token: Token;
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

  async prepareAdvice(
    state: AccountState,
    amount: bigint,
    tokenAddress: `0x${string}`
  ): Promise<NewAccountAdvice> {
    const { nullifier, trapdoor } =
      await this.cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce)
      );
    const anonymityRevokerPubkey = await this.contract.anonymityRevokerPubkey();
    return {
      id: state.id,
      nullifier,
      trapdoor,
      tokenAddress: Scalar.fromAddress(tokenAddress),
      initialDeposit: Scalar.fromBigint(amount),
      anonymityRevokerPubkey: {
        x: Scalar.fromBigint(anonymityRevokerPubkey.x),
        y: Scalar.fromBigint(anonymityRevokerPubkey.y)
      }
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
    const tokenAddress = getTokenAddress(state.token);

    const time = Date.now();

    const advice = await this.prepareAdvice(state, amount, tokenAddress);
    const proof = await this.cryptoClient.newAccountCircuit
      .prove(advice)
      .catch((e) => {
        throw new Error(`Failed to prove new account: ${e}`);
      });
    const pubInputs =
      await this.cryptoClient.newAccountCircuit.pubInputs(advice);
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
      amount,
      token: state.token
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
    const encodedCalldata =
      calldata.token.type === "native"
        ? await this.contract.newAccountNativeCalldata(
            expectedContractVersion,
            from,
            scalarToBigint(pubInputs.hNote),
            scalarToBigint(pubInputs.hId),
            amount,
            scalarToBigint(pubInputs.symKeyEncryption),
            proof
          )
        : await this.contract.newAccountTokenCalldata(
            expectedContractVersion,
            calldata.token.address,
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
