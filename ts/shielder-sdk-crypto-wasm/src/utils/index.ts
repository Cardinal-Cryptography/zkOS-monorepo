export function flatUint8(arr: Uint8Array[]) {
  return new Uint8Array(
    arr.reduce((acc, val) => new Uint8Array([...acc, ...val]), new Uint8Array())
  );
}
