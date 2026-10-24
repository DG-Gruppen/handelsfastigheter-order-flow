import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  createHandoffKeyPair,
  isValidPublicKey,
  isValidState,
  openTokens,
  parseAuthCallbackUrl,
  randomState,
  sealTokens,
} from "./authHandoff";

const tokens = { access_token: "header.payload.signature", refresh_token: "r3fr3sh" };

describe("authHandoff", () => {
  it("round-trips a session through the callback URL", async () => {
    const { publicKey, privateKey } = await createHandoffKeyPair();
    const state = randomState();
    expect(isValidPublicKey(publicKey)).toBe(true);
    expect(isValidState(state)).toBe(true);

    const sealed = await sealTokens(publicKey, tokens, state);
    const url = buildAuthCallbackUrl({ state, ...sealed });
    expect(url.startsWith("se.handelsfastigheter.intra://auth-callback?")).toBe(true);
    expect(url).not.toContain(tokens.refresh_token);

    const parsed = parseAuthCallbackUrl(url);
    if (!parsed || "error" in parsed) throw new Error("expected sealed callback");
    await expect(openTokens(privateKey, parsed, parsed.state)).resolves.toEqual(tokens);
  });

  it("rejects a session sealed for another key or state", async () => {
    const app = await createHandoffKeyPair();
    const other = await createHandoffKeyPair();
    const state = randomState();
    const sealed = await sealTokens(app.publicKey, tokens, state);

    await expect(openTokens(other.privateKey, sealed, state)).rejects.toThrow();
    await expect(openTokens(app.privateKey, sealed, randomState())).rejects.toThrow();
  });

  it("parses errors and ignores unrelated links", () => {
    const state = randomState();
    expect(parseAuthCallbackUrl(buildAuthCallbackUrl({ state, error: "Avbruten" }))).toEqual({ state, error: "Avbruten" });
    expect(parseAuthCallbackUrl("https://intra.handelsfastigheter.se/dashboard")).toBeNull();
    expect(parseAuthCallbackUrl("se.handelsfastigheter.intra://auth-callback?state=x")).toEqual({
      state: "x",
      error: "Ofullständigt svar från inloggningen",
    });
  });

  it("validates key and state format", () => {
    expect(isValidPublicKey("abc")).toBe(false);
    expect(isValidPublicKey(null)).toBe(false);
    expect(isValidState("ABC")).toBe(false);
  });
});
