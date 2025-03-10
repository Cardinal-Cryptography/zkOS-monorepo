import { IContract } from "@/chain/contract";
import {
  CryptoClient,
  Proof,
  Scalar,
  scalarToBigint,
  WithdrawAdvice,
  WithdrawPubInputs
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { Address, encodePacked, hexToBigInt, keccak256 } from "viem";
import { IRelayer } from "@/chain/relayer";
import { INonceGenerator, NoteAction } from "@/actions/utils";
import { Token } from "@/types";
import { getAddressByToken } from "@/utils";
import { OutdatedSdkError } from "@/errors";
import { AccountState, AccountStateMerkleIndexed } from "@/state/types";
import { SendShielderTransaction } from "@/client/types";

export interface WithdrawCalldata {
  expectedContractVersion: `0x${string}`;
  calldata: {
    pubInputs: WithdrawPubInputs<Scalar>;
    proof: Proof;
  };
  provingTimeMillis: number;
  amount: bigint;
  withdrawalAddress: Address;
  totalFee: bigint;
  token: Token;
}

export class WithdrawAction extends NoteAction {
  private contract: IContract;
  private relayer: IRelayer;
  private nonceGenerator: INonceGenerator;
  private chainId: bigint;

  constructor(
    contract: IContract,
    relayer: IRelayer,
    cryptoClient: CryptoClient,
    nonceGenerator: INonceGenerator,
    chainId: bigint
  ) {
    super(cryptoClient);
    this.contract = contract;
    this.relayer = relayer;
    this.nonceGenerator = nonceGenerator;
    this.chainId = chainId;
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
          ["bytes3", "uint256", "uint256", "uint256", "uint256"],
          [
            expectedContractVersion,
            hexToBigInt(address),
            hexToBigInt(relayerAddress),
            relayerFee,
            this.chainId
          ]
        )
      )
    );

    // Truncating to fit in the field size, as in the contract.
    const commitment = encodingHash >> 4n;

    return Scalar.fromBigint(commitment);
  }

  async prepareAdvice(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    expectedContractVersion: `0x${string}`,
    withdrawalAddress: `0x${string}`,
    relayerAddress: `0x${string}`,
    totalFee: bigint
  ): Promise<WithdrawAdvice<Scalar>> {
    const lastNodeIndex = state.currentNoteIndex;
    const [merklePath] = await this.merklePathAndRoot(
      await this.contract.getMerklePath(lastNodeIndex)
    );

    const tokenAddress = getAddressByToken(state.token);

    const idHidingNonce = this.nonceGenerator.randomIdHidingNonce();

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
      withdrawalAddress,
      relayerAddress,
      totalFee
    );

    return {
      id: state.id,
      nonce: idHidingNonce,
      nullifierOld,
      trapdoorOld,
      accountBalanceOld: Scalar.fromBigint(state.balance),
      tokenAddress: Scalar.fromAddress(tokenAddress),
      path: merklePath,
      value: Scalar.fromBigint(amount),
      nullifierNew,
      trapdoorNew,
      commitment,
      macSalt: await this.randomSalt()
    };
  }

  /**
   * Generate calldata for withdrawing `amount` from the account.
   * The amount must include the relayer fee, e.g. `amount = value + totalFee`,
   * where `value` is the targeted amount to withdraw.
   * @param state current account state
   * @param amount amount to withdraw, excluding the relayer fee
   * @param totalFee total relayer fee, usually a sum of base fee and relay fee (can be less, in which case relayer looses money)
   * @param withdrawalAddress recipient address
   * @returns calldata for withdrawal action
   */
  async generateCalldata(
    state: AccountStateMerkleIndexed,
    amount: bigint,
    relayerAddress: Address,
    totalFee: bigint,
    withdrawalAddress: Address,
    expectedContractVersion: `0x${string}`
  ): Promise<WithdrawCalldata> {
    if (state.balance < amount) {
      throw new Error("Insufficient funds");
    }
    if (amount < totalFee) {
      throw new Error(
        `Amount must be greater than the relayer fee: ${totalFee.toString()}`
      );
    }

    const time = Date.now();

    const advice = await this.prepareAdvice(
      state,
      amount,
      expectedContractVersion,
      withdrawalAddress,
      relayerAddress,
      totalFee
    );

    const proof = await this.cryptoClient.withdrawCircuit
      .prove(advice)
      .catch((e) => {
        throw new Error(`Failed to prove withdrawal: ${e}`);
      });
    const pubInputs = await this.cryptoClient.withdrawCircuit.pubInputs(advice);
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
      withdrawalAddress,
      totalFee,
      token: state.token
    };
  }

  /**
   * Withdraw `amount` from the account.
   * Calls the relayer to perform the withdrawal on the blockchain.
   * @param calldata calldata for withdrawal action
   * @returns transaction hash of the withdraw transaction
   * @throws VersionRejectedByRelayer
   */
  async sendCalldataWithRelayer(calldata: WithdrawCalldata) {
    const {
      expectedContractVersion,
      calldata: { pubInputs, proof },
      amount,
      withdrawalAddress
    } = calldata;
    const { tx_hash: txHash } = await this.relayer
      .withdraw(
        expectedContractVersion,
        calldata.token,
        calldata.totalFee,
        scalarToBigint(pubInputs.idHiding),
        scalarToBigint(pubInputs.hNullifierOld),
        scalarToBigint(pubInputs.hNoteNew),
        scalarToBigint(pubInputs.merkleRoot),
        amount,
        proof,
        withdrawalAddress,
        scalarToBigint(pubInputs.macSalt),
        scalarToBigint(pubInputs.macCommitment)
      )
      .catch((e) => {
        if (e instanceof OutdatedSdkError) {
          throw e;
        }
        throw new Error(`Failed to withdraw: ${e}`);
      });
    return txHash as `0x${string}`;
  }

  async sendCalldata(
    calldata: WithdrawCalldata,
    sendShielderTransaction: SendShielderTransaction,
    from: `0x${string}`
  ) {
    const {
      calldata: { pubInputs, proof },
      amount,
      withdrawalAddress,
      totalFee
    } = calldata;
    const encodedCalldata =
      calldata.token.type === "native"
        ? await this.contract.withdrawNativeCalldata(
            calldata.expectedContractVersion,
            from,
            withdrawalAddress,
            from, // use sender as relayer
            totalFee,
            scalarToBigint(pubInputs.idHiding),
            scalarToBigint(pubInputs.hNullifierOld),
            scalarToBigint(pubInputs.hNoteNew),
            scalarToBigint(pubInputs.merkleRoot),
            amount,
            scalarToBigint(pubInputs.macSalt),
            scalarToBigint(pubInputs.macCommitment),
            proof
          )
        : await this.contract.withdrawTokenCalldata(
            calldata.expectedContractVersion,
            calldata.token.address,
            from,
            withdrawalAddress,
            from, // use sender as relayer
            totalFee,
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
      data: encodedCalldata,
      to: this.contract.getAddress(),
      value: 0n
    }).catch((e) => {
      if (e instanceof OutdatedSdkError) {
        throw e;
      }
      throw new Error(`Failed to withdraw: ${e}`);
    });
    return txHash;
  }
}
