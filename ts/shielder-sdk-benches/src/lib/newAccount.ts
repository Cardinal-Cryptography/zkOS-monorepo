import {
  CryptoClient,
  Scalar,
  scalarToBigint
} from "@cardinal-cryptography/shielder-sdk-crypto";
import {
  nativeToken,
  ShielderClient
} from "@cardinal-cryptography/shielder-sdk";
import { idSeed } from "./utils";

export const newAccountFunction = async (cryptoClient: CryptoClient) => {
  const map = new Map<string, string>();
  let provingTime: number | null = null;
  const storage = {
    getItem(key: string) {
      return Promise.resolve(map.get(key) ?? null);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
      return Promise.resolve();
    }
  };
  const shielderClient = new ShielderClient(
    idSeed,
    0,
    {
      anonymityRevokerPubkey: () => {
        return {
          x: 13047962412999764541622307168798214567117102499726409864401719805657573314725n,
          y: 19469418064516647102437993012931876976878887157218366097795068165671813765190n
        };
      }
    } as any,
    {} as any,
    storage,
    {} as any,
    cryptoClient,
    {
      randomIdHidingNonce: () => Scalar.fromBigint(0n)
    },
    {
      onCalldataGenerated: (calldata, _) => {
        console.log(scalarToBigint((calldata as any).calldata.pubInputs.hNote));
        console.log(
          scalarToBigint((calldata as any).calldata.pubInputs.initialDeposit)
        );
        provingTime = calldata.provingTimeMillis;
      }
    }
  );
  try {
    await shielderClient.shield(
      nativeToken(),
      100n,
      {} as any,
      "" as `0x${string}`
    );
  } catch (err) {
    console.error(err);
  }
  if (provingTime === null) {
    throw new Error("Proving time not set");
  }
  return provingTime as number;
};
