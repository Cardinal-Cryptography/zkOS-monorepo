/**
 * @typedef {Uint8Array} Scalar A scalar type, which wraps
 * raw byte representation of halo2curves::bn256::Fr.
 * It also exposes a method to convert unsigned BigInt to scalar.
 */

import { Address, hexToBigInt } from "viem";

export const r =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function bytesToBigint(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = 31; i >= 0; i--) {
    result <<= 8n;
    result += BigInt(bytes[i]);
  }
  return result;
}

export class Scalar {
  bytes: Uint8Array;

  /**
   * @param bytes the bytes of the scalar in little-endian form
   * @throws if the bytes are not 32 bytes long
   * use only when wrapping WASM-produced scalar output
   */
  constructor(bytes: Uint8Array) {
    if (bytes.length !== 32) {
      throw new Error(`Scalar must be 32 bytes long, but got ${bytes.length}`);
    }
    const bigint = bytesToBigint(bytes);
    if (bigint < 0 || bigint >= r) {
      throw new Error(`Scalar must be between 0 and ${r - 1n}`);
    }
    this.bytes = bytes;
  }

  /**
   * Converts a bigint to a scalar.
   * A value is convertible to scalar type if it is a non-negative integer less than r.
   *
   * @param value the value to convert
   * @returns the value as a scalar
   * @throws if the value is not convertible to scalar
   */
  static fromBigint(value: bigint) {
    return new Scalar(bigintToScalarBytes(value));
  }

  /**
   * Converts an ethereum address to a scalar.
   * @param address ethereum address
   * @returns scalar representation of the address
   * @throws if the address is incorrect (not 20 bytes hex string)
   */
  static fromAddress(address: Address) {
    const addressBigint = hexToBigInt(address);
    return Scalar.fromBigint(addressBigint);
  }
}

/**
 * Checks if a value is convertible to scalar type.
 * A value is convertible to scalar type if it is a non-negative integer less than r.
 *
 * @param value the value to check
 * @returns if the value is convertible to scalar type
 */
export function isBigintScalar(value: bigint): boolean {
  return value >= 0n && value < r;
}

/**
 * Converts a bigint to a raw byte representation in
 * halo2curves::bn256::Fr little-endian format.
 * A value is convertible if it is a non-negative integer less than r.
 *
 * @param value the value to convert
 * @returns the value as a raw bytes
 * @throws if the value is not convertible to scalar type
 */
function bigintToScalarBytes(value: bigint): Uint8Array {
  if (!isBigintScalar(value)) {
    throw new Error(`Value ${value} is not a scalar`);
  }
  const result = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    result[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return result;
}

export function scalarToBigint(scalar: Scalar): bigint {
  return bytesToBigint(scalar.bytes);
}

export function scalarsEqual(a: Scalar, b: Scalar): boolean {
  return a.bytes.every((byte, i) => byte === b.bytes[i]);
}

/**
 * Converts a scalar to little endian bit array, represented as Uint8Array.
 *
 * @returns the scalar as a little-endian bit array. Every bit is represented
 * as Uint8. The length of the array is 254.
 */
export function toBits(scalar: Scalar) {
  const result = new Uint8Array(254);
  for (let i = 0; i < 32; i++) {
    for (let j = 0; j < 8; j++) {
      result[i * 8 + j] = (scalar.bytes[i] >> j) & 1 ? 1 : 0;
    }
  }
  return result;
}
