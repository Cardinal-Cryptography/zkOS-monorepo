import {
  Address,
  bytesToHex,
  encodeFunctionData,
  getContract,
  GetContractReturnType,
  Hash,
  PublicClient
} from "viem";

import { abi } from "../_generated/abi";
import { shieldActionGasLimit } from "@/constants";

export type NoteEvent = {
  name: "NewAccountNative" | "DepositNative" | "WithdrawNative";
  amount: bigint;
  newNoteIndex: bigint;
  newNote: bigint;
  txHash: Hash;
  to?: Address;
  block: bigint;
};

const getShielderContract = (
  account: PublicClient,
  contractAddress: Address
): GetContractReturnType<typeof abi, PublicClient, Address> => {
  return getContract({
    abi,
    address: contractAddress,
    client: account
  });
};

export type IContract = {
  getAddress: () => Address;
  getMerklePath: (idx: bigint) => Promise<readonly bigint[]>;
  newAccountCalldata: (
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  depositCalldata: (
    from: Address,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array
  ) => Promise<`0x${string}`>;
  nullifierBlock: (nullifierHash: bigint) => Promise<bigint | null>;
  getNoteEventsFromBlock: (block: bigint) => Promise<NoteEvent[]>;
};

export class Contract implements IContract {
  account: PublicClient;
  contract: ReturnType<typeof getShielderContract>;

  constructor(account: PublicClient, contractAddress: Address) {
    this.account = account;
    this.contract = getShielderContract(account, contractAddress);
  }

  getAddress = () => {
    return this.contract.address;
  };

  getMerklePath = async (idx: bigint): Promise<readonly bigint[]> => {
    return (await this.contract.read.getMerklePath([idx])) as readonly bigint[];
  };

  newAccountCalldata = async (
    from: Address,
    newNote: bigint,
    idHash: bigint,
    amount: bigint,
    proof: Uint8Array
  ) => {
    await this.contract.simulate.newAccountNative(
      [newNote, idHash, bytesToHex(proof)],
      {
        account: from,
        value: amount,
        gas: shieldActionGasLimit
      }
    );
    return encodeFunctionData({
      abi,
      functionName: "newAccountNative",
      args: [newNote, idHash, bytesToHex(proof)]
    });
  };

  depositCalldata = async (
    from: Address,
    idHiding: bigint,
    oldNoteNullifierHash: bigint,
    newNote: bigint,
    merkleRoot: bigint,
    amount: bigint,
    proof: Uint8Array
  ) => {
    await this.contract.simulate.depositNative(
      [idHiding, oldNoteNullifierHash, newNote, merkleRoot, bytesToHex(proof)],
      { account: from, value: amount, gas: shieldActionGasLimit }
    );
    return encodeFunctionData({
      abi,
      functionName: "depositNative",
      args: [
        idHiding,
        oldNoteNullifierHash,
        newNote,
        merkleRoot,
        bytesToHex(proof)
      ]
    });
  };

  /**
   * Returns the block number in which the nullifier was used.
   * If the nullifier was not used, returns null
   * @param nullifierHash hash of the nullifier to look for
   * @returns block number in which the nullifier was used, or null if it was not used
   */
  nullifierBlock = async (nullifierHash: bigint): Promise<bigint | null> => {
    const blockNumber = await this.contract.read.nullifiers([nullifierHash]);
    if (blockNumber === 0n) {
      return null;
    }
    return blockNumber - 1n;
  };

  /**
   * Fetch the note indices from the contract by block number and filter them.
   * Stops fetching when the first event with tag is found.
   * @param block
   * @returns event array
   */
  getNoteEventsFromBlock = async (block: bigint) => {
    const fromBlock = block;
    const toBlock = block;
    const newAccountEvents = await this.contract.getEvents.NewAccountNative({
      fromBlock,
      toBlock
    });
    const depositEvents = await this.contract.getEvents.DepositNative({
      fromBlock,
      toBlock
    });
    const withdrawEvents = await this.contract.getEvents.WithdrawNative({
      fromBlock,
      toBlock
    });
    const mergedIndices = [
      ...newAccountEvents,
      ...depositEvents,
      ...withdrawEvents
    ].map((event) => {
      return {
        name: event.eventName,
        amount: event.args.amount!,
        newNoteIndex: event.args.newNoteIndex!,
        newNote: event.args.newNote!,
        txHash: event.transactionHash,
        block: event.blockNumber,
        to:
          event.eventName === "WithdrawNative"
            ? (event.args.to as Address)
            : undefined
      } as NoteEvent;
    });
    return mergedIndices;
  };
}
