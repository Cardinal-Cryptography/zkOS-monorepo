import { execSync } from "child_process";
import { expect } from "@playwright/test";

import { sdkTest, unpackUint8Array } from "@tests/playwrightTestUtils";

sdkTest("poseidonHash agrees with Rust", async ({ workerPage }) => {
  const hasher = await workerPage.evaluateHandle(async () => {
    return window.crypto.createHasher();
  });

  for (const tupleLength of [1, 2, 3, 7]) {
    const { hashedTupleBytes, hash } = await workerPage.evaluate(
      async ({ hasher, tupleLength }) => {
        const hashedTuple = Array.from({ length: tupleLength }, (_, i) => {
          return window.crypto.scalar.fromBigint(2n ** 253n - BigInt(i));
        });

        const hashedTupleBytes = new Uint8Array(tupleLength * 32);
        for (let i = 0; i < tupleLength; i++) {
          hashedTupleBytes.set(hashedTuple[i].bytes, i * 32);
        }

        return {
          hashedTupleBytes,
          hash: hasher.poseidonHash(hashedTuple).bytes,
        };
      },
      { hasher, tupleLength },
    );

    execSync(
      `../../target/debug/test-ts-conversions` +
        ` poseidon-hash-agrees-with-rust` +
        ` --hashed-tuple ${unpackUint8Array(hashedTupleBytes)}` +
        ` --expected-hash ${unpackUint8Array(hash)}`,
      {
        stdio: "ignore",
      },
    );
  }
});

sdkTest(
  "poseidonHash returns error if tuple size exceeds arity",
  async ({ workerPage }) => {
    const result = await workerPage.evaluate(async () => {
      const hasher = window.crypto.createHasher();

      const hashedTuple = Array.from({ length: 8 }, () => {
        return window.crypto.scalar.fromBigint(0n);
      });

      try {
        hasher.poseidonHash(hashedTuple);
      } catch (error) {
        return error;
      }
      return "success";
    });

    if (result instanceof Error) {
      expect(result.message).toContain("Input too large");
    } else {
      throw new Error(`expected an error, got '${result}'`);
    }
  },
);

sdkTest("returns correct arity", async ({ workerPage }) => {
  const arity = await workerPage.evaluate(async () => {
    const hasher = window.crypto.createHasher();
    return hasher.arity();
  });

  expect(arity).toStrictEqual(7);
});

sdkTest("returns correct tree height", async ({ workerPage }) => {
  const arity = await workerPage.evaluate(async () => {
    const hasher = window.crypto.createHasher();
    return hasher.treeHeight();
  });

  expect(arity).toStrictEqual(13);
});
