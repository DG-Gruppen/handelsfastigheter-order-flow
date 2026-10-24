/**
 * Krypterad överlämning av inloggningssessionen från systemwebbläsaren till appen.
 *
 * Google tillåter inte inloggning i appens inbäddade webbvy, så appen öppnar
 * /app-auth.html i systemwebbläsaren. Appen skickar med en tillfällig publik
 * ECDH-nyckel; sidan krypterar sessionen till den nyckeln och skickar tillbaka
 * resultatet via appens URL-schema. En annan app som fångar länken kan alltså
 * inte läsa sessionen. Modulen används både av appen och av app-auth-sidan och
 * får därför inte importera Supabase-klienten.
 */

export const APP_URL_SCHEME = "se.handelsfastigheter.intra";
export const AUTH_CALLBACK_URL = `${APP_URL_SCHEME}://auth-callback`;

const HKDF_INFO = new TextEncoder().encode("shf-intra-app-auth-v1");
const STATE_PATTERN = /^[0-9a-f]{32}$/;

export interface HandoffTokens {
  access_token: string;
  refresh_token: string;
}

export interface SealedTokens {
  epk: string;
  iv: string;
  ct: string;
}

export interface HandoffKeyPair {
  /** Okomprimerad P-256-nyckel, base64url. */
  publicKey: string;
  privateKey: JsonWebKey;
}

export type AuthCallback = ({ state: string } & SealedTokens) | { state: string; error: string };

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomState(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidState(value: string | null | undefined): value is string {
  return typeof value === "string" && STATE_PATTERN.test(value);
}

/** En okomprimerad P-256-nyckel är 65 byte och börjar med 0x04. */
export function isValidPublicKey(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(value)) return false;
  const bytes = fromBase64Url(value);
  return bytes.length === 65 && bytes[0] === 0x04;
}

function importPublicKey(raw: string) {
  return crypto.subtle.importKey("raw", fromBase64Url(raw), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

async function deriveAesKey(privateKey: CryptoKey, peerPublicKey: CryptoKey, usage: KeyUsage) {
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: peerPublicKey }, privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: HKDF_INFO },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function createHandoffKeyPair(): Promise<HandoffKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { publicKey: toBase64Url(raw), privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey) };
}

/** Körs i webbläsaren: krypterar sessionen till appens publika nyckel. state binds till chiffertexten. */
export async function sealTokens(appPublicKey: string, tokens: HandoffTokens, state: string): Promise<SealedTokens> {
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const key = await deriveAesKey(ephemeral.privateKey, await importPublicKey(appPublicKey), "encrypt");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token }),
  );
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(state) },
    key,
    plaintext,
  );
  const epk = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  return { epk: toBase64Url(epk), iv: toBase64Url(iv), ct: toBase64Url(new Uint8Array(ct)) };
}

/** Körs i appen: dekrypterar sessionen med den privata nyckel som skapades när inloggningen startade. */
export async function openTokens(privateKeyJwk: JsonWebKey, sealed: SealedTokens, state: string): Promise<HandoffTokens> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const key = await deriveAesKey(privateKey, await importPublicKey(sealed.epk), "decrypt");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(sealed.iv), additionalData: new TextEncoder().encode(state) },
    key,
    fromBase64Url(sealed.ct),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as Partial<HandoffTokens>;
  if (typeof parsed.access_token !== "string" || typeof parsed.refresh_token !== "string") {
    throw new Error("Ofullständig session");
  }
  return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
}

export function buildAuthCallbackUrl(callback: AuthCallback): string {
  const params = new URLSearchParams(
    "error" in callback
      ? { state: callback.state, error: callback.error }
      : { state: callback.state, epk: callback.epk, iv: callback.iv, ct: callback.ct },
  );
  return `${AUTH_CALLBACK_URL}?${params.toString()}`;
}

/** Returnerar null för länkar som inte är appens inloggningssvar. */
export function parseAuthCallbackUrl(url: string): AuthCallback | null {
  if (!url.startsWith(`${AUTH_CALLBACK_URL}?`)) return null;
  const params = new URLSearchParams(url.slice(AUTH_CALLBACK_URL.length + 1));
  const state = params.get("state") ?? "";
  const error = params.get("error");
  if (error !== null) return { state, error };
  const epk = params.get("epk");
  const iv = params.get("iv");
  const ct = params.get("ct");
  if (!epk || !iv || !ct) return { state, error: "Ofullständigt svar från inloggningen" };
  return { state, epk, iv, ct };
}
