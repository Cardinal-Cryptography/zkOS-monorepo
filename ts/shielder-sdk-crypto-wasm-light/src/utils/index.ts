export function flatUint8(arr: Uint8Array[]) {
  return new Uint8Array(
    arr.reduce((acc, val) => new Uint8Array([...acc, ...val]), new Uint8Array())
  );
}

export function objectToBytes(object: unknown): Uint8Array {
  const jsonString = JSON.stringify(object, (key, value) => {
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  });
  return new TextEncoder().encode(jsonString);
}

export function bytesToObject(bytes: Uint8Array): unknown {
  const jsonString = new TextDecoder().decode(bytes);
  return JSON.parse(jsonString) as unknown;
}

/**
 * Converts a Uint8Array to a base64 string
 * @param bytes - The bytes to convert
 * @returns The base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Converts a base64 string to a Uint8Array
 * @param base64 - The base64 string to convert
 * @returns The Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ToHex(uint8: Uint8Array): string {
  return Array.from(uint8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToUint8(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
