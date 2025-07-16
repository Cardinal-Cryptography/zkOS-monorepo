import { uint8ToHex } from "@/nitro-attestation";
import { hexToUint8 } from "@/utils";
import * as secp from "@noble/secp256k1";

type Keypair = { sk: Uint8Array; pk: Uint8Array };

export function generateKeypair(): Keypair {
  const sk = secp.utils.randomPrivateKey();
  const pk = secp.getPublicKey(sk, true);
  return { sk, pk };
}

async function hkdf(
  sharedSecret: Uint8Array,
  cryptoAPI: Crypto
): Promise<CryptoKey> {
  const keyMaterial = await cryptoAPI.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return cryptoAPI.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array([]),
      info: new TextEncoder().encode("ecies-secp256k1-v1")
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(
  message: Uint8Array,
  recipientPub: secp.Point
): Promise<Uint8Array> {
  const cryptoAPI = await getCrypto();

  const ephSk = secp.utils.randomPrivateKey();
  const ephPk = secp.getPublicKey(ephSk, true);

  const ephSkBigInt = BigInt("0x" + uint8ToHex(ephSk));
  const shared = recipientPub.multiply(ephSkBigInt).toRawBytes(true);
  const aesKey = await hkdf(shared, cryptoAPI);

  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await cryptoAPI.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    message
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  const out = new Uint8Array(ephPk.length + iv.length + ciphertext.length);
  out.set(ephPk);
  out.set(iv, ephPk.length);
  out.set(ciphertext, ephPk.length + iv.length);

  return out;
}

export async function decrypt(
  bytes: Uint8Array,
  recipientSkHex: string
): Promise<Uint8Array> {
  const cryptoAPI = await getCrypto();
  const ephPk = secp.Point.fromHex(bytes.slice(0, 33));
  const iv = bytes.slice(33, 45);
  const ciphertext = bytes.slice(45);

  const skBytes = hexToUint8(recipientSkHex);
  const skBigInt = BigInt("0x" + uint8ToHex(skBytes));
  const shared_point = ephPk.multiply(skBigInt);
  const shared = shared_point.toRawBytes(true);
  const aesKey = await hkdf(shared, cryptoAPI);

  const plaintextBuffer = await cryptoAPI.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );
  return new Uint8Array(plaintextBuffer);
}

async function getCrypto(): Promise<Crypto> {
  return typeof globalThis.crypto !== "undefined"
    ? globalThis.crypto
    : ((await import("node:crypto")).webcrypto as Crypto);
}
