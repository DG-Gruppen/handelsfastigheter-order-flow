import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { getAppBaseUrl } from "@/lib/utils";
import { createHandoffKeyPair, openTokens, parseAuthCallbackUrl, randomState } from "./authHandoff";

const PENDING_KEY = "shf-native-google-login";
const MAX_AGE_MS = 10 * 60 * 1000;

interface PendingLogin {
  state: string;
  privateKey: JsonWebKey;
  createdAt: number;
}

/**
 * Google-inloggning i appen. Google blockerar inloggning i appens webbvy,
 * så den görs i systemwebbläsaren via /app-auth.html (se src/app-auth/main.ts).
 * Den privata nyckeln sparas lokalt ifall appen stängs medan webbläsaren är öppen.
 */
export async function startNativeGoogleSignIn(): Promise<void> {
  const { publicKey, privateKey } = await createHandoffKeyPair();
  const pending: PendingLogin = { state: randomState(), privateKey, createdAt: Date.now() };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const url = new URL("/app-auth.html", getAppBaseUrl());
  url.searchParams.set("pk", publicKey);
  url.searchParams.set("state", pending.state);
  await Browser.open({ url: url.toString() });
}

function takePendingLogin(): PendingLogin | null {
  const raw = localStorage.getItem(PENDING_KEY);
  localStorage.removeItem(PENDING_KEY);
  try {
    const pending = raw ? (JSON.parse(raw) as PendingLogin) : null;
    return pending && Date.now() - pending.createdAt < MAX_AGE_MS ? pending : null;
  } catch {
    return null;
  }
}

export type NativeSignInResult = { handled: false } | { handled: true; error: string | null };

/** Hanterar se.handelsfastigheter.intra://auth-callback. Övriga länkar lämnas orörda. */
export async function completeNativeGoogleSignIn(url: string): Promise<NativeSignInResult> {
  const callback = parseAuthCallbackUrl(url);
  if (!callback) return { handled: false };

  // Stänger webbläsarvyn på iOS; på Android är den redan stängd när appen öppnas.
  void Browser.close().catch(() => undefined);

  const pending = takePendingLogin();
  if (!pending || callback.state !== pending.state) {
    return { handled: true, error: "Inloggningen har gått ut. Försök igen." };
  }
  if ("error" in callback) return { handled: true, error: callback.error };

  try {
    const tokens = await openTokens(pending.privateKey, callback, pending.state);
    const { error } = await supabase.auth.setSession(tokens);
    return { handled: true, error: error ? error.message : null };
  } catch (error) {
    console.error("Native sign-in failed", error);
    return { handled: true, error: "Kunde inte slutföra inloggningen. Försök igen." };
  }
}
