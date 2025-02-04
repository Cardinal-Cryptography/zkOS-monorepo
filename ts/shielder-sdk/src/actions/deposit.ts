import { IContract, VersionRejectedByContract } from "@/chain/contract";
import {
  CryptoClient,
  DepositPubInputs,
  Proof,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { SendShielderTransaction } from "@/client";
import { Calldata } from "@/actions";
import { INonceGenerator, NoteAction } from "@/actions/utils";
import { AccountState } from "@/state";

export interface DepositCalldata extends Calldata {
  calldata: {
    pubInputs: DepositPubInputs;
    proof: Proof;
  };
  expectedContractVersion: `0x${string}`;
  amount: bigint;
  merkleRoot: Scalar;
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

  async preparePubInputs(
    state: AccountState,
    amount: bigint,
    nonce: Scalar,
    nullifierOld: Scalar,
    merkleRoot: Scalar
  ): Promise<DepositPubInputs> {
    const hId = await this.cryptoClient.hasher.poseidonHash([state.id]);
    const idHiding = await this.cryptoClient.hasher.poseidonHash([hId, nonce]);

    const hNullifierOld = await this.cryptoClient.hasher.poseidonHash([
      nullifierOld
    ]);
    const newState = await this.rawDeposit(state, amount);
    if (newState === null) {
      throw new Error(
        "Failed to deposit, possibly due to insufficient balance"
      );
    }
    const hNoteNew = newState.currentNote;
    return {
      hNullifierOld,
      hNoteNew,
      idHiding,
      merkleRoot,
      value: Scalar.fromBigint(amount)
    };
  }

  /**
   * Generate calldata for depositing `amount` into the account.
   * @param state current account state
   * @param amount amount to deposit
   * @returns calldata for deposit action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint,
    expectedContractVersion: `0x${string}`
  ): Promise<DepositCalldata> {
    const lastNodeIndex = state.currentNoteIndex!;
    const [path, merkleRoot] = await this.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );
    const nonce = this.nonceGenerator.randomIdHidingNonce();

    if (state.currentNoteIndex === undefined) {
      throw new Error("currentNoteIndex must be set");
    }

    const time = Date.now();

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

    const proof = await this.cryptoClient.depositCircuit
      .prove({
        id: state.id,
        nonce,
        nullifierOld,
        trapdoorOld,
        accountBalanceOld: Scalar.fromBigint(state.balance),
        path,
        value: Scalar.fromBigint(amount),
        nullifierNew,
        trapdoorNew
      })
      .catch((e) => {
        throw new Error(`Failed to prove deposit: ${e}`);
      });
    const pubInputs = await this.preparePubInputs(
      state,
      amount,
      nonce,
      nullifierOld,
      merkleRoot
    );
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
      merkleRoot
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
      amount,
      merkleRoot
    } = calldata;
    const encodedCalldata = await this.contract.depositCalldata(
      calldata.expectedContractVersion,
      from,
      scalarToBigint(pubInputs.idHiding),
      scalarToBigint(pubInputs.hNullifierOld),
      scalarToBigint(pubInputs.hNoteNew),
      scalarToBigint(merkleRoot),
      amount,
      proof
    );
    const txHash = await sendShielderTransaction({
      data: encodedCalldata,
      to: this.contract.getAddress(),
      value: amount
    }).catch((e) => {
      if (e instanceof VersionRejectedByContract) {
        throw e;
      }
      throw new Error(`Failed to deposit: ${e}`);
    });
    return txHash;
  }
}
