import { expect } from "@playwright/test";

import { sdkTest, unpackUint8Array } from "@tests/playwrightTestUtils";

// https://docs.rs/ark-bn254/latest/ark_bn254/
const fieldModulusMinusOne: bigint =
  21888242871839275222246405745257275088548364400416034343698204186575808495616n;

// python3 -c 'print(hex(21888242871839275222246405745257275088548364400416034343698204186575808495616))'
const fieldModulusMinusOneHex: `0x${string}` =
  "0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000";

// python3 -c 'print(hex(1 + 2 * 21888242871839275222246405745257275088548364400416034343698204186575808495617))'
const onePlusDoubleFieldModulusHex: `0x${string}` =
  "0x60c89ce5c263405370a08b6d0302b0ba5067d090f372e12287c3eb27e0000003";

sdkTest(
  "returns correct value if there's no overflow",
  async ({ workerPage }) => {
    const { expectedBytes, actualBytes } = await workerPage.evaluate(
      ({ fieldModulusMinusOne, fieldModulusMinusOneHex }) => {
        const expectedBytes =
          window.crypto.scalar.fromBigint(fieldModulusMinusOne).bytes;

        const converter = window.crypto.createConverter();
        const actualBytes = converter.privateKeyToScalar(
          fieldModulusMinusOneHex,
        ).bytes;

        return { expectedBytes, actualBytes };
      },
      { fieldModulusMinusOne, fieldModulusMinusOneHex },
    );

    expect(actualBytes).toEqual(expectedBytes);
  },
);

sdkTest(
  "returns correct value if there is overflow",
  async ({ workerPage }) => {
    const actualBytes = await workerPage.evaluate(
      (onePlusDoubleFieldModulusHex) => {
        const converter = window.crypto.createConverter();
        return converter.privateKeyToScalar(onePlusDoubleFieldModulusHex).bytes;
      },
      onePlusDoubleFieldModulusHex,
    );

    expect(unpackUint8Array(actualBytes)).toEqual(
      Object.assign(new Uint8Array(32), { 0: 1 }),
    );
  },
);
