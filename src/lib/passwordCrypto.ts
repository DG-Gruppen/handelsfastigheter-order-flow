/**
 * AES-GCM encryption utilities for the shared password manager.
 *
 * The encryption key is a hex string fetched from the `get-passwords-key`
 * Edge Function (JWT-protected). It is never stored in localStorage or
 * persisted beyond the browser session.
 *
 * Ciphertext format stored in DB: base64(iv[12 bytes] || ciphertext)
 */

const ALGO = "AES-GCM";
const KEY_LENGTH = 256;

/** Import a raw hex key string as a CryptoKey */
async function importKey(hexKey: string): Promise<CryptoKey> {
  const raw = hexToBytes(hexKey);
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: ALGO, length: KEY_LENGTH }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Encrypt plaintext, returns base64-encoded iv+ciphertext */
export async function encrypt(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.byteLength);
  return bytesToBase64(combined);
}

/** Decrypt base64-encoded iv+ciphertext, returns plaintext */
export async function decrypt(ciphertext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const combined = base64ToBytes(ciphertext);
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: ALGO, iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

/**
 * Detect if a string looks like an encrypted payload (base64, >= 20 chars).
 * Used to handle both legacy plaintext and new encrypted values during migration.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 20) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(value);
}
