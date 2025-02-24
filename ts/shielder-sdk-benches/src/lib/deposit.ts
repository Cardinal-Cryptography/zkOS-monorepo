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

export const depositFunction = async (cryptoClient: CryptoClient) => {
  const map = new Map<string, string>();
  let provingTime: number | null = null;
  const storage = {
    getItem(_: string) {
      return Promise.resolve(
        JSON.stringify({
          idHash:
            "19082161650081407282156963943076085013750563695878128475663910836929515570025",
          nonce: "1",
          balance: "100",
          currentNote:
            "14135820158254164229380323413277496649947616153335595624950916058106847054958",
          currentNoteIndex: "0",
          storageSchemaVersion: 1
        })
      );
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
      getMerklePath: async (_: bigint) => {
        const path = new Array<bigint>(
          (await cryptoClient.noteTreeConfig.arity()) *
            (await cryptoClient.noteTreeConfig.treeHeight()) +
            1
        ).fill(0n);
        path[0] =
          14135820158254164229380323413277496649947616153335595624950916058106847054958n;
        const arity = await cryptoClient.noteTreeConfig.arity();
        for (let i = 1; i < path.length; i++) {
          const children = Array<bigint>(arity).fill(0n);
          children[0] = path[i - 1];
          path[i] = scalarToBigint(
            await cryptoClient.hasher.poseidonHash(
              children.map(Scalar.fromBigint)
            )
          );
        }
        return path;
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
