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
    .map((i) => i.toString(16).padStart(2, "0"))
    .join("");
}
