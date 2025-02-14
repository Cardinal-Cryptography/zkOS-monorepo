export function flatUint8(arr: Uint8Array[]) {
  return new Uint8Array(
    arr.reduce((acc, val) => new Uint8Array([...acc, ...val]), new Uint8Array())
  );
}
export function splitUint8(arr: Uint8Array, chunkSize: number) {
  if (arr.length % chunkSize !== 0) {
    throw new Error("Array length is not a multiple of chunkSize");
  }
  const res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    res.push(arr.slice(i, i + chunkSize));
  }
  return res;
}
