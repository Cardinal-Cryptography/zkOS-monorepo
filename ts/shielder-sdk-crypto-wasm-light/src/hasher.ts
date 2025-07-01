import {
  Scalar,
  Hasher as IHasher
} from "@cardinal-cryptography/shielder-sdk-crypto";
import { flatUint8 } from "./utils";
import * as singleThreadedWasm from "shielder_bindings/web-singlethreaded";

export class Hasher implements IHasher {
  poseidonHash(input: Scalar[]): Promise<Scalar> {
    if (input.length == 0) {
      throw new Error("Empty input");
    }
    if (input.length > singleThreadedWasm.poseidon_rate()) {
      throw new Error("Input too large");
    }
    return Promise.resolve(
      new Scalar(
        singleThreadedWasm.poseidon_hash(flatUint8(input.map((s) => s.bytes)))
      )
    );
  }

  poseidonRate(): Promise<number> {
    return Promise.resolve(singleThreadedWasm.poseidon_rate());
  }
}
