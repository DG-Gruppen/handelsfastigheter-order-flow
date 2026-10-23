/**
 * Mellanstation för Google-inloggning i Android/iOS-appen (öppnas i systemwebbläsaren).
 *
 * 1. Appen öppnar /app-auth.html?pk=<publik nyckel>&state=<state>.
 * 2. Sidan skickar vidare till Lovables inloggning, som kommer tillbaka hit med sessionen i URL:en.
 * 3. Sidan krypterar sessionen till appens nyckel och öppnar appen via se.handelsfastigheter.intra://.
 *
 * Sidan laddar inte Supabase-klienten, så ingen session sparas i webbläsaren.
 */
import {
  buildAuthCallbackUrl,
  isValidPublicKey,
  isValidState,
  randomState,
  sealTokens,
} from "@/lib/native/authHandoff";

const STORAGE_KEY = "shf-app-auth-request";
const GOOGLE_WORKSPACE_DOMAIN = "handelsfastigheter.se";

interface PendingRequest {
  pk: string;
  state: string;
  brokerState: string;
}

function show(title: string, message: string, appUrl?: string) {
  document.getElementById("title")!.textContent = title;
  document.getElementById("message")!.textContent = message;
  const button = document.getElementById("open-app") as HTMLAnchorElement;
  if (appUrl) {
    button.href = appUrl;
    button.classList.add("visible");
  }
}

/** Samma tolkning som supabase-js: parametrar i både # och ?, där ? vinner. */
function readParams(url: URL): Record<string, string> {
  const result: Record<string, string> = {};
  new URLSearchParams(url.hash.replace(/^#/, "")).forEach((value, key) => (result[key] = value));
  url.searchParams.forEach((value, key) => (result[key] = value));
  return result;
}

function readPending(): PendingRequest | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as PendingRequest | null;
    return parsed && isValidPublicKey(parsed.pk) && isValidState(parsed.state) ? parsed : null;
  } catch {
    return null;
  }
}

function openApp(url: string) {
  show("Inloggad", "Öppnar SHF Intra-appen. Du kan stänga den här fliken.", url);
  window.location.href = url;
}

async function run() {
  const url = new URL(window.location.href);
  const pk = url.searchParams.get("pk");
  const state = url.searchParams.get("state");

  if (pk !== null) {
    if (!isValidPublicKey(pk) || !isValidState(state)) {
      show("Ogiltig länk", "Starta inloggningen från SHF Intra-appen.");
      return;
    }
    const pending: PendingRequest = { pk, state, brokerState: randomState() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    const params = new URLSearchParams({
      provider: "google",
      redirect_uri: `${window.location.origin}${window.location.pathname}`,
      state: pending.brokerState,
      hd: GOOGLE_WORKSPACE_DOMAIN,
    });
    window.location.replace(`/~oauth/initiate?${params.toString()}`);
    return;
  }

  const params = readParams(url);
  // Ta bort sessionen ur adressfältet och historiken direkt.
  history.replaceState(null, "", window.location.pathname);
  const pending = readPending();
  sessionStorage.removeItem(STORAGE_KEY);

  if (!pending) {
    show("Inloggningen gick inte att slutföra", "Starta inloggningen igen från SHF Intra-appen.");
    return;
  }

  const fail = (message: string) =>
    openApp(buildAuthCallbackUrl({ state: pending.state, error: message }));

  if (params.state && params.state !== pending.brokerState) return fail("Inloggningen kunde inte verifieras");
  if (params.error || params.error_description) {
    return fail(params.error_description || params.error || "Inloggningen misslyckades");
  }
  if (!params.access_token || !params.refresh_token) return fail("Inget svar från inloggningen");

  try {
    const sealed = await sealTokens(
      pending.pk,
      { access_token: params.access_token, refresh_token: params.refresh_token },
      pending.state,
    );
    openApp(buildAuthCallbackUrl({ state: pending.state, ...sealed }));
  } catch (error) {
    console.error("App-auth sealing failed", error);
    fail("Kunde inte skicka inloggningen till appen");
  }
}

void run();
