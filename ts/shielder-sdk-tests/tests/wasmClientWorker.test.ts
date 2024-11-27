import { execSync } from "child_process";
import { expect } from "@playwright/test";

import { sdkTest, unpackUint8Array } from "@tests/playwrightTestUtils";

sdkTest("proveAndVerifyNewAccount succeeds", async ({ workerPage }) => {
  await workerPage.evaluate(async () => {
    const wasmClientWorker = window.wasmClientWorker.getWorker();
    const newAccountValues = window.crypto.testUtils.exampleNewAccountValues();

    await wasmClientWorker.proveAndVerifyNewAccount(newAccountValues);
  });
});

sdkTest("proveAndVerifyDeposit succeeds", async ({ workerPage }) => {
  await workerPage.evaluate(async () => {
    const wasmClientWorker = window.wasmClientWorker.getWorker();
    const hasher = window.crypto.createHasher();
    const depositValues = window.crypto.testUtils.exampleDepositValues(hasher);

    await wasmClientWorker.proveAndVerifyDeposit(depositValues);
  });
});

sdkTest("proveAndVerifyWithdraw succeeds", async ({ workerPage }) => {
  await workerPage.evaluate(async () => {
    const wasmClientWorker = window.wasmClientWorker.getWorker();
    const hasher = window.crypto.createHasher();
    const withdrawValues =
      window.crypto.testUtils.exampleWithdrawValues(hasher);

    await wasmClientWorker.proveAndVerifyWithdraw(withdrawValues);
  });
});

sdkTest("poseidonHash agrees with Rust", async ({ workerPage }) => {
  const { hashedTupleBytes, hash } = await workerPage.evaluate(async () => {
    const tupleLength = 3;

    const hashedTuple = Array.from({ length: tupleLength }, (_, i) => {
      return window.crypto.scalar.fromBigint(2n ** 253n - BigInt(i));
    });

    const hashedTupleBytes = new Uint8Array(tupleLength * 32);
    for (let i = 0; i < tupleLength; i++) {
      hashedTupleBytes.set(hashedTuple[i].bytes, i * 32);
    }

    const wasmClientWorker = window.wasmClientWorker.getWorker();
    const hash = await wasmClientWorker.poseidonHash(hashedTuple);

    return { hashedTupleBytes, hash: hash.bytes };
  });

  execSync(
    `../../target/debug/test-ts-conversions` +
      ` padded-poseidon-hash-agrees-with-rust` +
      ` --hashed-tuple ${unpackUint8Array(hashedTupleBytes)}` +
      ` --expected-hash ${unpackUint8Array(hash)}`,
    {
      stdio: "ignore",
    },
  );
});

sdkTest("getSecrets agrees with Rust", async ({ workerPage }) => {
  for (const nonce of [0n, 1n, 2n ** 32n - 1n]) {
    const { id, nullifier, trapdoor } = await workerPage.evaluate(
      async (nonce) => {
        const wasmClientWorker = window.wasmClientWorker.getWorker();
        const id = window.crypto.scalar.fromBigint(2n ** 253n);

        const { nullifier, trapdoor } = await wasmClientWorker.getSecrets(
          id,
          nonce,
        );

        return {
          id: id.bytes.toString(),
          nullifier: nullifier.bytes.toString(),
          trapdoor: trapdoor.bytes.toString(),
        };
      },
      nonce,
    );

    execSync(
      `../../target/debug/test-ts-conversions` +
        ` wasm-secrets-agree-with-rust` +
        ` --seed ${id}` +
        ` --nonce ${nonce}` +
        ` --expected-nullifier ${nullifier}` +
        ` --expected-trapdoor ${trapdoor}`,
      {
        stdio: "ignore",
      },
    );
  }
});

const privateKeyToScalar = async (privateKey: string) => {
  const wasmClientWorker = window.wasmClientWorker.getWorker();
  const actual = await wasmClientWorker.privateKeyToScalar(
    privateKey as "0x{string}",
  );
  return actual.bytes;
};

sdkTest("privateKeyToScalar returns correct result", async ({ workerPage }) => {
  // https://hackage.haskell.org/package/elliptic-curve-0.2.2/docs/src/Curve.Weierstrass.BN254.html
  const onePlusFieldModulusHex: `0x${string}` =
    "0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000002";

  const actualBytes = await workerPage.evaluate(
    privateKeyToScalar,
    onePlusFieldModulusHex,
  );

  expect(unpackUint8Array(actualBytes)).toEqual(
    Object.assign(new Uint8Array(32), { 0: 1 }),
  );
});

sdkTest(
  "privateKeyToScalar correctly handles maximal address",
  async ({ workerPage }) => {
    // python3 -c 'print(hex(2 ** 256 - 1))'
    const maxAddressHex: `0x${string}` =
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    // field modulus from https://docs.rs/ark-bn254/latest/ark_bn254/
    // python3 -c 'print(hex((2 ** 256 - 1) % 21888242871839275222246405745257275088548364400416034343698204186575808495617))'
    const equivalentAddressHex =
      "0xe0a77c19a07df2f666ea36f7879462e36fc76959f60cd29ac96341c4ffffffa";

    const actualBytes = await workerPage.evaluate(
      privateKeyToScalar,
      maxAddressHex,
    );

    const expectedBytes = await workerPage.evaluate(
      privateKeyToScalar,
      equivalentAddressHex,
    );

    expect(unpackUint8Array(actualBytes)).toEqual(
      unpackUint8Array(expectedBytes),
    );
  },
);
