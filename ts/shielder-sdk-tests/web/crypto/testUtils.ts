import {
  type Caller,
  type DepositValues,
  Hasher,
  type NewAccountValues,
  Scalar,
  type WithdrawValues,
} from "shielder-sdk/__internal__";

export function navigatorHardwareConcurrencyOrThreadsOverrideFromEnv(): number {
  const threads = process.env.PLASMO_PUBLIC_THREADS;

  if (!threads || threads === "max") {
    return navigator.hardwareConcurrency;
  } else {
    return parseInt(threads);
  }
}

export function getCaller(): Caller {
  return navigatorHardwareConcurrencyOrThreadsOverrideFromEnv() === 1
    ? "web_singlethreaded"
    : "web_multithreaded";
}

export function flatUint82d(arr: Uint8Array[][]) {
  return new Uint8Array(
    arr.reduce(
      (acc, val) => new Uint8Array([...acc, ...window.utils.flatUint8(val)]),
      new Uint8Array(),
    ),
  );
}

export function generateNoteHash(
  hasher: Hasher,
  noteVersion: Scalar,
  id: Scalar,
  nullifierOld: Scalar,
  trapdoorOld: Scalar,
  accountBalanceOld: Scalar,
): Scalar {
  const scalarArray: Scalar[] = new Array<Scalar>(hasher.arity()).fill(
    Scalar.fromBigint(0n),
  );
  scalarArray[0] = accountBalanceOld;
  const hAccountBalanceOld = hasher.poseidonHash(scalarArray);
  return hasher.poseidonHash([
    noteVersion,
    id,
    nullifierOld,
    trapdoorOld,
    hAccountBalanceOld,
  ]);
}

export function generateMerklePath(
  hasher: Hasher,
  leaf: Scalar,
): [Scalar, Uint8Array] {
  const arity = hasher.arity();
  const treeHeight = hasher.treeHeight();

  const path: Scalar[][] = Array.from({ length: treeHeight }, () => {
    return Array.from({ length: arity }, () => {
      return window.crypto.scalar.fromBigint(101n);
    });
  });
  path[0][0] = leaf;

  for (let i = 1; i < treeHeight; i++) {
    const idx = Math.floor(Math.random() * arity);
    path[i][idx] = hasher.poseidonHash(path[i - 1]);
  }

  const root = hasher.poseidonHash(path[treeHeight - 1]);

  return [root, flatUint82d(path.map((x) => x.map((y) => y.bytes)))];
}

export function exampleNewAccountValues(): NewAccountValues {
  const id = window.crypto.scalar.fromBigint(101n);
  const nullifier = window.crypto.scalar.fromBigint(102n);
  const trapdoor = window.crypto.scalar.fromBigint(103n);
  const initialDeposit = window.crypto.scalar.fromBigint(2n);

  return { id, nullifier, trapdoor, initialDeposit };
}

export function exampleDepositValues(hasher: Hasher): DepositValues {
  const noteVersion = window.crypto.scalar.fromBigint(0n);
  const id = window.crypto.scalar.fromBigint(1n);
  const nullifierOld = window.crypto.scalar.fromBigint(2n);
  const trapdoorOld = window.crypto.scalar.fromBigint(3n);
  const accountBalanceOld = window.crypto.scalar.fromBigint(100n);
  const hNoteOld = window.crypto.testUtils.generateNoteHash(
    hasher,
    noteVersion,
    id,
    nullifierOld,
    trapdoorOld,
    accountBalanceOld,
  );
  const [merkleRoot, path] = window.crypto.testUtils.generateMerklePath(
    hasher,
    hNoteOld,
  );
  const value = window.crypto.scalar.fromBigint(10n);
  const nullifierNew = window.crypto.scalar.fromBigint(4n);
  const trapdoorNew = window.crypto.scalar.fromBigint(5n);
  const accountBalanceNew = window.crypto.scalar.fromBigint(110n);

  return {
    id,
    nullifierOld,
    trapdoorOld,
    accountBalanceOld,
    merkleRoot,
    path,
    value,
    nullifierNew,
    trapdoorNew,
    accountBalanceNew,
  };
}

export function exampleWithdrawValues(hasher: Hasher): WithdrawValues {
  const id = window.crypto.scalar.fromBigint(1n);
  const noteVersion = window.crypto.scalar.fromBigint(0n);
  const nullifierOld = window.crypto.scalar.fromBigint(2n);
  const trapdoorOld = window.crypto.scalar.fromBigint(3n);
  const accountBalanceOld = window.crypto.scalar.fromBigint(100n);
  const hNoteOld = window.crypto.testUtils.generateNoteHash(
    hasher,
    noteVersion,
    id,
    nullifierOld,
    trapdoorOld,
    accountBalanceOld,
  );
  const [merkleRoot, path] = window.crypto.testUtils.generateMerklePath(
    hasher,
    hNoteOld,
  );
  const value = window.crypto.scalar.fromBigint(10n);
  const nullifierNew = window.crypto.scalar.fromBigint(4n);
  const trapdoorNew = window.crypto.scalar.fromBigint(5n);
  const accountBalanceNew = window.crypto.scalar.fromBigint(90n);
  const relayerAddress = window.crypto.scalar.fromBigint(6n);
  const relayerFee = window.crypto.scalar.fromBigint(1n);
  const address = window.crypto.scalar.fromBigint(7n);

  return {
    id,
    nullifierOld,
    trapdoorOld,
    accountBalanceOld,
    merkleRoot,
    path,
    value,
    nullifierNew,
    trapdoorNew,
    accountBalanceNew,
    relayerAddress,
    relayerFee,
    address,
  };
}
