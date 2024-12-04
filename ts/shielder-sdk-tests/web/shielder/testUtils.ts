/* eslint-disable @typescript-eslint/no-unused-vars */
import { mockedStorage } from "@/storage/mockedStorage";
import type {
  IContract,
  InjectedStorageInterface,
  IRelayer,
  NoteEvent,
  QuoteFeesResponse,
  SendShielderTransaction,
  WithdrawResponse,
} from "shielder-sdk/__internal__";
import type { PublicClient } from "viem";

export class MockedContract implements IContract {
  merklePaths: Map<bigint, readonly bigint[]>;
  txHashToReturn: `0x${string}` | null = null;

  constructor() {
    this.merklePaths = new Map();
  }

  getAddress = (): `0x${string}` => {
    return ("0x" + "0".repeat(40)) as `0x${string}`;
  };

  getMerklePath = async (idx: bigint): Promise<readonly bigint[]> => {
    if (!this.merklePaths.has(idx)) {
      throw new Error(`Merkle path for index ${idx} not found`);
    }
    return this.merklePaths.get(idx)!;
  };
  newAccountCalldata = async (
    _expectedContractVersion: `0x${string}`,
    _from: `0x${string}`,
    _newNote: bigint,
    _idHash: bigint,
    _amount: bigint,
    _proof: Uint8Array,
  ): Promise<`0x${string}`> => {
    if (this.txHashToReturn === null) {
      throw new Error("No tx hash to return");
    }
    return this.txHashToReturn;
  };
  depositCalldata = async (
    _expectedContractVersion: `0x${string}`,
    _from: `0x${string}`,
    _idHiding: bigint,
    _oldNoteNullifierHash: bigint,
    _newNote: bigint,
    _merkleRoot: bigint,
    _amount: bigint,
    _proof: Uint8Array,
  ): Promise<`0x${string}`> => {
    throw new Error("Not implemented");
  };
  withdraw = async (
    _expectedContractVersion: `0x${string}`,
    _idHiding: bigint,
    _oldNullifierHash: bigint,
    _newNote: bigint,
    _merkleRoot: bigint,
    _amount: bigint,
    _proof: Uint8Array,
    _withdrawAddress: `0x${string}`,
    _relayerAddress: `0x${string}`,
    _relayerFee: bigint,
  ): Promise<`0x${string}`> => {
    throw new Error("Not implemented");
  };
  nullifierBlock = async (_nullifierHash: bigint): Promise<bigint | null> => {
    return null;
  };
  getNoteEventsFromBlock = async (_block: bigint): Promise<NoteEvent[]> => {
    throw new Error("Not implemented");
  };
}

export class MockedRelayer implements IRelayer {
  txHashToReturn: `0x${string}` | null = null;
  address: `0x${string}`;
  constructor(address: `0x${string}`) {
    this.address = address;
  }
  withdraw = async (
    _expectedContractVersion: `0x${string}`,
    _idHiding: bigint,
    _oldNullifierHash: bigint,
    _newNote: bigint,
    _merkleRoot: bigint,
    _amount: bigint,
    _proof: Uint8Array,
    _withdrawAddress: `0x${string}`,
  ): Promise<WithdrawResponse> => {
    throw new Error("Not implemented");
  };
  quoteFees = async (): Promise<QuoteFeesResponse> => {
    throw new Error("Not implemented");
  };
}

export const mockedServices = (
  userAddress: `0x${string}`,
): {
  contract: MockedContract;
  relayer: MockedRelayer;
  storage: InjectedStorageInterface;
  publicClient: PublicClient;
  sendTx: SendShielderTransaction;
} => {
  const contract = new MockedContract();
  const relayer = new MockedRelayer(
    "0x0000000000000000000000000000000000000001",
  );
  const storage = mockedStorage(userAddress);
  const publicClient = {
    waitForTransactionReceipt: async (): Promise<void> => {},
  } as unknown as PublicClient;
  const sendTx = (async () => {
    return "0x" + "0".repeat(64);
  }) as unknown as SendShielderTransaction;
  return { contract, relayer, storage, publicClient, sendTx };
};
