import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  Proof,
  Scalar,
  scalarToBigint,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { AccountState } from "@/state";
import { Address, encodePacked, hexToBigInt, keccak256 } from "viem";
import { IRelayer, VersionRejectedByRelayer } from "@/chain/relayer";
import { INonceGenerator, NoteAction } from "@/actions/utils";

export interface WithdrawCalldata {
  expectedContractVersion: `0x${string}`;
  calldata: {
    pubInputs: WithdrawPubInputs;
    proof: Proof;
  };
  provingTimeMillis: number;
  amount: bigint;
  address: Address;
  merkleRoot: Scalar;
}

export class WithdrawAction extends NoteAction {
  private contract: IContract;
  private relayer: IRelayer;
  private nonceGenerator: INonceGenerator;

  constructor(
    contract: IContract,
    relayer: IRelayer,
    cryptoClient: CryptoClient,
    nonceGenerator: INonceGenerator
  ) {
    super(cryptoClient);
    this.contract = contract;
    this.relayer = relayer;
    this.nonceGenerator = nonceGenerator;
  }

  /**
   * Return the updated state after withdrawing `amount` from `stateOld`.
   * Does not perform the actual withdrawal on blockchain.
   * @param stateOld
   * @param amount amount to withdraw
   * @returns updated state
   */
  async rawWithdraw(
    stateOld: AccountState,
    amount: bigint
  ): Promise<AccountState | null> {
    return await this.rawAction(
      stateOld,
      amount,
      (currentBalance: bigint, amount: bigint) => currentBalance - amount
    );
  }

  calculateCommitment(
    expectedContractVersion: `0x${string}`,
    address: `0x${string}`,
    relayerAddress: `0x${string}`,
    relayerFee: bigint
  ): Scalar {
    const encodingHash = hexToBigInt(
      keccak256(
        encodePacked(
          ["bytes3", "uint256", "uint256", "uint256"],
          [
            expectedContractVersion,
            hexToBigInt(address),
            hexToBigInt(relayerAddress),
            relayerFee
          ]
        )
      )
    );

    // Truncating to fit in the field size, as in the contract.
    const commitment = encodingHash >> 4n;

    return Scalar.fromBigint(commitment);
  }

  async preparePubInputs(
    state: AccountState,
    amount: bigint,
    nonce: Scalar,
    nullifierOld: Scalar,
    merkleRoot: Scalar,
    commitment: Scalar
  ): Promise<WithdrawPubInputs> {
    const hId = await this.cryptoClient.hasher.poseidonHash([state.id]);
    const idHiding = await this.cryptoClient.hasher.poseidonHash([hId, nonce]);

    const hNullifierOld = await this.cryptoClient.hasher.poseidonHash([
      nullifierOld
    ]);

    const newNote = await this.rawWithdraw(state, amount);

    if (newNote === null) {
      throw new Error(
        "Failed to withdraw, possibly due to insufficient balance"
      );
    }

    const hNoteNew = newNote.currentNote;

    return {
      hNullifierOld,
      hNoteNew,
      idHiding,
      merkleRoot,
      value: Scalar.fromBigint(amount),
      commitment
    };
  }

  /**
   * Generate calldata for withdrawing `amount` from the account.
   * The amount must include the relayer fee, e.g. `amount = value + totalFee`,
   * where `value` is the targeted amount to withdraw.
   * @param state current account state
   * @param amount amount to withdraw, excluding the relayer fee
   * @param totalFee total relayer fee, usually a sum of base fee and relay fee (can be less, in which case relayer looses money)
   * @param address recipient address
   * @returns calldata for withdrawal action
   */
  async generateCalldata(
    state: AccountState,
    amount: bigint,
    totalFee: bigint,
    address: Address,
    expectedContractVersion: `0x${string}`
  ): Promise<WithdrawCalldata> {
    const lastNodeIndex = state.currentNoteIndex!;
    const [path, merkleRoot] = await this.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    const nonce = this.nonceGenerator.randomIdHidingNonce();

    if (state.currentNoteIndex === undefined) {
      throw new Error("currentNoteIndex must be set");
    }
    if (state.balance < amount) {
      throw new Error("Insufficient funds");
    }
    if (amount < totalFee) {
      throw new Error(
        `Amount must be greater than the relayer fee: ${totalFee.toString()}`
      );
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

    const commitment = this.calculateCommitment(
      expectedContractVersion,
      address,
      await this.relayer.address(),
      totalFee
    );

    const proof = await this.cryptoClient.withdrawCircuit
      .prove({
        id: state.id,
        nonce,
        nullifierOld,
        trapdoorOld,
        accountBalanceOld: Scalar.fromBigint(state.balance),
        path,
        value: Scalar.fromBigint(amount),
        nullifierNew,
        trapdoorNew,
        commitment
      })
      .catch((e) => {
        throw new Error(`Failed to prove withdrawal: ${e}`);
      });
    const pubInputs = await this.preparePubInputs(
      state,
      amount,
      nonce,
      nullifierOld,
      merkleRoot,
      commitment
    );
    if (!(await this.cryptoClient.withdrawCircuit.verify(proof, pubInputs))) {
      throw new Error("Withdrawal proof verification failed");
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
      address,
      merkleRoot
    };
  }

  /**
   * Withdraw `amount` from the account.
   * Calls the relayer to perform the withdrawal on the blockchain.
   * @param calldata calldata for withdrawal action
   * @returns transaction hash of the withdraw transaction
   * @throws VersionRejectedByRelayer
   */
  async sendCalldata(calldata: WithdrawCalldata) {
    const {
      expectedContractVersion,
      calldata: { pubInputs, proof },
      amount,
      address,
      merkleRoot
    } = calldata;
    const { tx_hash: txHash } = await this.relayer
      .withdraw(
        expectedContractVersion,
        scalarToBigint(pubInputs.idHiding),
        scalarToBigint(pubInputs.hNullifierOld),
        scalarToBigint(pubInputs.hNoteNew),
        scalarToBigint(merkleRoot),
        amount,
        proof,
        address
      )
      .catch((e) => {
        if (e instanceof VersionRejectedByRelayer) {
          throw e;
        }
        throw new Error(`Failed to withdraw: ${e}`);
      });
    return txHash as `0x${string}`;
  }
}
