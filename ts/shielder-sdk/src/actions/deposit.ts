import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  DepositAdvice,
  DepositPubInputs,
  Proof,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Calldata } from "./types";
import { INonceGenerator, NoteAction } from "@/actions/utils";
import { Token } from "@/types";
import { getAddressByToken } from "@/utils";
import { OutdatedSdkError } from "@/errors";
import { AccountState, AccountStateMerkleIndexed } from "@/state/types";
import { SendShielderTransaction } from "@/client/types";

export interface DepositCalldata extends Calldata {
  calldata: {
    pubInputs: DepositPubInputs<Scalar>;
    proof: Proof;
  };
  expectedContractVersion: `0x${string}`;
  amount: bigint;
  token: Token;
}

export class DepositAction extends NoteAction {
  private contract: IContract;
  private nonceGenerator: INonceGenerator;

  constructor(
    contract: IContract,
    cryptoClient: CryptoClient,
    nonceGenerator: INonceGenerator
  ) {
    super(cryptoClient);
    this.contract = contract;
    this.nonceGenerator = nonceGenerator;
  }

  /**
   * Return the updated state after depositing `amount` into `stateOld`.
   * Does not perform the actual deposit on blockchain.
   * @param stateOld
   * @param amount amount to deposit
   * @returns updated state
   */
  async rawDeposit(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await this.rawAction(
      stateOld,
      amount,
      (currentBalance: bigint, amount: bigint) => currentBalance + amount
    );
  }

  async prepareAdvice(
    state: AccountStateMerkleIndexed,
    amount: bigint
  ): Promise<DepositAdvice<Scalar>> {
    const lastNodeIndex = state.currentNoteIndex;
    const [merklePath] = await this.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    const tokenAddress = getAddressByToken(state.token);

    const nonce = this.nonceGenerator.randomIdHidingNonce();
    const { nullifier: nullifierOld, trapdoor: trapdoorOld } =
      await this.cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce - 1n)
      );
    const { nullifier: nullifierNew, trapdoor: trapdoorNew } =
      await this.cryptoClient.secretManager.getSecrets(
        state.id,
        Number(state.nonce)
      );
    return {
      id: state.id,
      nonce,
      nullifierOld,
      trapdoorOld,
      accountBalanceOld: Scalar.fromBigint(state.balance),
      tokenAddress: Scalar.fromAddress(tokenAddress),
      path: merklePath,
      value: Scalar.fromBigint(amount),
      nullifierNew,
      trapdoorNew,
      macSalt: await this.randomSalt()
    };
  }

  /**
   * Generate calldata for depositing `amount` into the account.
   * @param state current account state
   * @param amount amount to deposit
   * @returns calldata for deposit action
   */
  async generateCalldata(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    expectedContractVersion: `0x${string}`
  ): Promise<DepositCalldata> {
    const time = Date.now();

    const advice = await this.prepareAdvice(state, amount);

    const proof = await this.cryptoClient.depositCircuit
      .prove(advice)
      .catch((e) => {
        throw new Error(`Failed to prove deposit: ${e}`);
      });
    const pubInputs = await this.cryptoClient.depositCircuit.pubInputs(advice);
    if (!(await this.cryptoClient.depositCircuit.verify(proof, pubInputs))) {
      throw new Error("Deposit proof verification failed");
    }

    const provingTime = Date.now() - time;
    return {
      calldata: {
        pubInputs,
        proof
      },
      expectedContractVersion,
      provingTimeMillis: provingTime,
      amount,
      token: state.token
    };
  }

  /**
   * Deposit `amount` into the account.
   * Calls the contract through RPC endpoint to perform the deposit on the blockchain.
   * @param calldata calldata for deposit action
   * @param sendShielderTransaction function to send the transaction to the blockchain
   * @returns transaction hash of the deposit transaction
   * @throws VersionRejectedByContract
   */
  async sendCalldata(
    calldata: DepositCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      amount
    } = calldata;
    const encodedCalldata =
      calldata.token.type === "native"
        ? await this.contract.depositNativeCalldata(
            calldata.expectedContractVersion,
            from,
            scalarToBigint(pubInputs.idHiding),
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof
          )
        : await this.contract.depositTokenCalldata(
            calldata.expectedContractVersion,
            calldata.token.address,
            from,
            scalarToBigint(pubInputs.idHiding),
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof
          );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata.calldata,
      to: this.contract.getAddress(),
      value: calldata.token.type === "native" ? amount : 0n,
      gas: encodedCalldata.gas
    }).catch((e) => {
      if (e instanceof OutdatedSdkError) {
        throw e;
      }
      throw new Error(`Failed to deposit: ${e}`);
    });
    return txHash;
  }
}
